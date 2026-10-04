import { PHASES } from './state.mjs';

export function applyRecord(state, args, headSha) {
  const { phase, result, evidence, surface, note, kind, gaps, touches, publicApi } = args;
  const name = PHASES[phase - 1];
  if (!name) throw new Error(`Unknown phase: ${phase}`);
  if (result !== 'pass' && result !== 'fail') throw new Error('--result must be pass or fail');
  if (kind) state.kind = kind;
  state.attempts ??= {};
  if (result === 'fail') {
    state.attempts[name] = (state.attempts[name] ?? 0) + 1;
    // Failing a phase invalidates it and everything built on it. Confirm failing goes back to
    // analysis; implement, review, visual and land failing go back to implement.
    const from = phase <= 2 ? 0 : phase >= 5 ? 4 : phase - 1;
    for (const n of PHASES.slice(from)) delete state.evidence[n];
    state.last_failure = { phase: name, evidence: evidence ?? null, note: note ?? null, at: new Date().toISOString() };
    // New work must follow this failure: the next implement step waits for a commit after it.
    if (phase >= 5) state.work_sha = headSha;
    return state;
  }
  state.attempts[name] = 0;
  if (state.last_failure?.phase === name) state.last_failure = null;
  const entry = { path: evidence ?? null, at: new Date().toISOString(), note: note ?? null };
  if (phase >= 5) {
    entry.sha = headSha;
    if (surface?.length) entry.surface = surface;
  }
  if (phase === 1) {
    state.analysis.blockingGaps = gaps ?? 0;
    if (!gaps) state.evidence.analyze = entry;
    return state;
  }
  if (phase === 4) {
    state.plan = { touches: touches ?? [], publicApi: !!publicApi };
    state.work_sha = headSha;
  }
  state.evidence[name] = entry;
  return state;
}
