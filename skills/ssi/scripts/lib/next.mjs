import { readState, writeState, normalize } from './state.mjs';
import { gitFacts } from './git.mjs';
import { findPr, whoami, readRemoteState, upsertStateComment, createIssue, isTransient } from './github.mjs';
import { renderBlock, mergeComment, stateHash } from './remote.mjs';
import { detectPhase } from './detect.mjs';
import { evaluateStops, mandateStop } from './stops.mjs';
import { actionFor } from './actions.mjs';
import { say, bar } from './say.mjs';
import { opAllowed } from './config.mjs';

export function computeNext({ cwd, config, run, gh }) {
  const warnings = [];
  const read = readState(cwd);
  if (read.warning) warnings.push(read.warning);
  const facts = gitFacts(run);
  let offline = false;
  let login = null;
  try {
    facts.pr = facts.branch && !facts.onBase ? findPr(gh, facts.branch, read.state?.pr ?? null) : null;
    if (facts.pr) login = whoami(gh);
  } catch {
    facts.pr = null;
    offline = true;
    warnings.push('GitHub is not reachable. I keep working locally and will catch up later.');
  }
  let state = read.state;
  let remote = null;
  if (facts.pr && !offline) {
    try {
      remote = readRemoteState(gh, facts.pr.number, login);
    } catch {
      offline = true;
    }
  }
  if (!state && remote) {
    state = normalize({ ...remote.state, pending: [], synced: null });
    warnings.push('My local notes were missing, so I restored them from the PR.');
  }
  if (!state) {
    const action = { kind: 'start', headline: 'Start a run', instructions: 'Run: ssi start "<what the user asked for>", then ssi next.', refs: [], requires: [] };
    return { phase: 0, name: 'start', done: false, action, stop: null, say: say({ phase: 0, name: 'start', next: action.headline, style: config.ui.style, needsUser: false, done: false }), warnings };
  }
  // A PR found on a branch this run does not live on is someone else's: never adopt it,
  // never write to it. The branch mismatch itself raises STOP_REALITY.
  if (state.branch && facts.branch && facts.branch !== state.branch) {
    facts.pr = null;
    remote = null;
  }
  if (facts.pr) state.pr = facts.pr.number;
  facts.commitsSinceStart = facts.commitsSince(state.start_sha ?? null);
  facts.workCommits = facts.commitsSince(state.work_sha ?? state.start_sha ?? null);
  if (!state.branch && facts.branch && !facts.onBase) state.branch = facts.branch;
  if (!offline) {
    for (const p of [...state.pending]) {
      if (p.op !== 'issue') continue;
      const drop = (why) => {
        state.pending = state.pending.filter((q) => q !== p);
        warnings.push(`Dropped a queued Issue: ${why}`);
      };
      if (!opAllowed('issue', config)) {
        drop('the config no longer allows issues.');
        continue;
      }
      try {
        state.issue = createIssue(gh, { title: p.title, body: p.body, key: `ssi:${state.run_id}:issue` }).number;
        state.pending = state.pending.filter((q) => q !== p);
      } catch (e) {
        if (isTransient(e)) offline = true;
        else drop(String(e.message).split('\n')[0]);
      }
    }
  }

  const det = detectPhase({ state, facts, config });
  warnings.push(...det.warnings);
  if (det.stale.length) warnings.push(`Some earlier results are out of date (${det.stale.join(', ')}), so I will redo them.`);
  state.phase = det.phase;

  let stop = evaluateStops({ state, facts, config, phase: det.phase });
  let action = null;
  if (!stop) {
    action = actionFor({ name: det.name, state, facts, config });
    const missing = action.requires.find((op) => !opAllowed(op, config));
    if (missing) stop = mandateStop(missing);
  }
  if (stop) {
    state.stop = stop;
    action = null;
  } else if (state.branch) {
    state.head_sha = facts.headSha;
  }

  if (facts.pr && !offline && opAllowed('comment', config)) {
    const hash = stateHash(state);
    if (hash !== state.synced || !remote) {
      try {
        const header = `**SSI progress** ${bar(det.phase)} ${Math.min(det.phase, 8)}/8`;
        upsertStateComment(gh, facts.pr.number, (existing) => mergeComment(existing, renderBlock(state, header)), login);
        state.synced = hash;
      } catch {
        warnings.push('I could not update the PR progress comment. I will retry next time.');
      }
    }
  }
  writeState(cwd, state);

  const done = action?.kind === 'done';
  const nextText = stop ? 'Answer the question below' : action.headline;
  return {
    phase: det.phase,
    name: det.name,
    done,
    action,
    stop,
    say: say({ phase: det.phase, name: det.name, next: nextText, style: config.ui.style, needsUser: !!stop, done }),
    warnings,
  };
}
