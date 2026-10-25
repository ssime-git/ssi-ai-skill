import { readState, writeState, normalize } from './state.mjs';
import { gitFacts } from './git.mjs';
import { findPr, whoami, readRemoteState, upsertStateComment, createIssue, isTransient } from './github.mjs';
import { renderBlock, mergeComment, stateHash } from './remote.mjs';
import { detectPhase } from './detect.mjs';
import { evaluateStops, mandateStop } from './stops.mjs';
import { actionFor } from './actions.mjs';
import { say, bar } from './say.mjs';
import { opAllowed } from './config.mjs';
import { evaluateGuards } from './guards.mjs';
import { targetOf } from './workflow.mjs';

// Landing is blocked until every applicable contract is pass or waived. The engine decides,
// not the agent: the action is replaced, so no instruction to land is ever emitted.
const GUARDED = new Set(['land', 'done']);
const SETTLED = ['pass', 'waived', 'n/a'];
function guardAction(g) {
  const bad = g.results.filter((r) => !SETTLED.includes(r.status));
  const list = bad.map((r) => `${r.id} (${r.status}${r.why ? ': ' + r.why : ''})`).join('; ');
  return {
    kind: 'satisfy-guards',
    headline: 'Cover the safety contracts before landing',
    instructions: `Run: ssi guards. These contracts are not proven: ${list}. Fix them in ssi.guards.json, or ask the user for a waiver (a waiver needs "by" and "reason" and is the user's decision, never yours). Then run: ssi next.`,
    refs: [],
    requires: [],
    guards: bad,
  };
}

export function computeNext({ cwd, config, run, gh, guards = evaluateGuards }) {
  const warnings = [];
  const read = readState(cwd);
  if (read.warning) warnings.push(read.warning);
  const local = targetOf(read.state ?? { workflow: config.workflow }) !== 'pr';
  const facts = gitFacts(run, { local, startSha: read.state?.start_sha });
  let offline = false;
  let login = null;
  try {
    if (!local) {
    facts.pr = facts.branch && !facts.onBase ? findPr(gh, facts.branch, read.state?.pr ?? null) : null;
    if (facts.pr) login = whoami(gh);
    }
  } catch {
    facts.pr = null;
    facts.prUnknown = true;
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
  // Progress made on another machine wins over an older local cache; writing the old cache
  // back would erase it from the PR.
  if (remote && remote.state.run_id === state.run_id && String(remote.state.updated_at ?? '') > String(state.updated_at ?? '')) {
    state = normalize({ ...remote.state, pending: state.pending, synced: null });
    warnings.push('Another machine made newer progress, so I took it from the PR.');
  }
  if (facts.pr) state.pr = facts.pr.number;
  facts.commitsSinceStart = facts.commitsSince(state.start_sha ?? null);
  facts.workCommits = facts.commitsSince(state.work_sha ?? state.start_sha ?? null);
  if (!state.branch && facts.branch && !facts.onBase) state.branch = facts.branch;
  if (!offline) {
    for (const p of [...state.pending]) {
      if (p.op !== 'issue') continue;
      if (state.issue_skipped && !p.followup) {
        state.pending = state.pending.filter((q) => q !== p);
        continue;
      }
      const drop = (why) => {
        state.pending = state.pending.filter((q) => q !== p);
        warnings.push(`Dropped a queued Issue: ${why}`);
      };
      if (!opAllowed('issue', config)) {
        drop('the config no longer allows issues.');
        continue;
      }
      try {
        const issue = createIssue(gh, { title: p.title, body: p.body, key: p.key ?? `ssi:${state.run_id}:issue` }).number;
        if (p.followup) state.followups = [...new Set([...state.followups, issue])];
        else state.issue = issue;
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
    if (targetOf(state) !== 'answer' && GUARDED.has(det.name) && !['push-changes', 'commit-changes', 'wait-for-github'].includes(action.kind)) {
      const g = guards(cwd, { changedFiles: facts.changedFiles });
      if (!g.ok) action = guardAction(g);
    }
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
  const done = action?.kind === 'done';
  state.last = { action: action?.kind ?? null, stop: stop?.code ?? null, done };
  writeState(cwd, state);

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
