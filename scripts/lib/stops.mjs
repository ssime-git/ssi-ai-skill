export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const stop = (code, because, question, options, def) => ({ code, because, question, options, default: def });

function reality(state, facts) {
  const mk = (because) =>
    stop('STOP_REALITY', because, 'How should I continue?', ['A. Adopt what is there now and keep going', 'B. Stop so you can fix it'], 'B');
  if (state.branch) {
    if (!facts.branchExists(state.branch)) return mk(`The branch ${state.branch} no longer exists.`);
    if (facts.branch !== state.branch) return mk(`This run lives on ${state.branch}, but you are on ${facts.branch}.`);
    if (state.head_sha && !facts.isAncestor(state.head_sha)) return mk('The branch history was rewritten (a force-push or a reset).');
  }
  if (state.pr && facts.pr && facts.pr.state !== 'OPEN') return mk(`PR #${state.pr} is ${facts.pr.state.toLowerCase()}.`);
  return null;
}

export function mandateStop(op) {
  return stop(
    'STOP_OUT_OF_MANDATE',
    `The next step needs "${op}", and the config does not allow it.`,
    'Should I wait while you change ssi.config.json?',
    ['A. I changed the config, try again', 'B. Stop here'],
    'B',
  );
}

export function evaluateStops({ state, facts, config, phase }) {
  if (state.stop && !state.stop.answer) return state.stop;
  const t = config.thresholds;
  const tries = (n) => state.attempts?.[n] ?? 0;
  const r = reality(state, facts);
  if (r) return r;
  if (state.analysis?.blockingGaps > 0) {
    return stop('STOP_UNCLEAR', `${state.analysis.blockingGaps} gap(s) in the request block me from starting.`, 'Can you answer the gaps I listed?', ['A. Answered, go on (add the answer)', 'B. Stop here'], 'A');
  }
  if (!state.evidence.reproduce && tries('reproduce') >= t.reproAttempts) {
    return stop('STOP_NO_REPRO', `I could not reproduce the bug after ${t.reproAttempts} tries.`, 'How should I continue?', ['A. Try again with a new idea (add it)', 'B. Stop and look together'], 'B');
  }
  const globs = config.protectedPaths.map(globToRegExp);
  const hit = (state.plan?.touches ?? []).filter((f) => globs.some((g) => g.test(f)));
  if (state.evidence.plan && !state.approvals.protected && (hit.length || state.plan.publicApi)) {
    return stop('STOP_PROTECTED', hit.length ? `The plan touches protected code: ${hit.join(', ')}.` : 'The plan changes a public interface.', 'Do you approve this change?', ['A. Yes, go ahead', 'B. No, stop here'], 'B');
  }
  if (phase >= 5 && phase <= 8 && !state.approvals.bigDiff && (facts.diff.lines > t.diff.lines || facts.diff.files > t.diff.files)) {
    return stop('STOP_BIG_DIFF', `The change is big: ${facts.diff.lines} lines in ${facts.diff.files} files (limits ${t.diff.lines} / ${t.diff.files}).`, 'Keep going with a big change?', ['A. Yes, keep going', 'B. No, stop and split it'], 'B');
  }
  if (!state.evidence.review && tries('review') >= t.reviewRounds) {
    return stop('STOP_REVIEW', `The review still found blockers after ${t.reviewRounds} rounds.`, 'How should I continue?', ['A. Try again (add guidance)', 'B. Stop and look together'], 'B');
  }
  if (!state.evidence.visual && tries('visual') >= t.visualRetries) {
    return stop('STOP_VISUAL', `The visual check failed ${t.visualRetries} times.`, 'How should I continue?', ['A. Try again (add guidance)', 'B. Stop and look together'], 'B');
  }
  if (!state.evidence.land && tries('land') >= t.ciRetries) {
    return stop('STOP_CI', `CI still fails after ${t.ciRetries} fixes.`, 'How should I continue?', ['A. Try again (add guidance)', 'B. Stop and look together'], 'B');
  }
  return null;
}

export function applyAnswer(state, facts, text) {
  const s = state.stop;
  if (!s) throw new Error('There is no open question.');
  if (/^\s*b\b/i.test(text)) {
    s.note = text;
    return state;
  }
  switch (s.code) {
    case 'STOP_PROTECTED': state.approvals.protected = true; break;
    case 'STOP_BIG_DIFF': state.approvals.bigDiff = true; break;
    case 'STOP_UNCLEAR':
      state.analysis.blockingGaps = 0;
      state.evidence.analyze = { path: null, at: new Date().toISOString(), note: text };
      break;
    case 'STOP_NO_REPRO': state.attempts.reproduce = 0; break;
    case 'STOP_REVIEW': state.attempts.review = 0; break;
    case 'STOP_VISUAL': state.attempts.visual = 0; break;
    case 'STOP_CI': state.attempts.land = 0; break;
    case 'STOP_REALITY':
      state.branch = facts.branch;
      state.head_sha = facts.headSha;
      if (facts.pr?.state && facts.pr.state !== 'OPEN') state.pr = null;
      break;
    default: break;
  }
  state.stop = null;
  return state;
}
