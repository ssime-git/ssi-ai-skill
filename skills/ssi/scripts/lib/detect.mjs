import { PHASES } from './state.mjs';
import { opAllowed } from './config.mjs';

const SHA_BOUND = new Set(['implement', 'review', 'visual', 'land']);

function skipped(state, facts, config) {
  const s = new Set();
  if (state.kind !== 'bug') s.add('reproduce');
  const v = config.visual.enabled;
  if (v === 'off' || (v === 'auto' && !facts.uiChanged)) s.add('visual');
  return s;
}

const touches = (file, surface) => surface.some((s) => file === s || file.startsWith(s.endsWith('/') ? s : `${s}/`));

function check(name, state, facts, config) {
  const e = state.evidence[name];
  if (!e) return { ok: false };
  if (name === 'reproduce' && !state.issue && opAllowed('issue', config) && !state.issue_skipped && !state.pending?.some((p) => p.op === 'issue')) return { ok: false };
  if (SHA_BOUND.has(name) && e.sha !== facts.headSha) {
    const changed = facts.changedSince(e.sha);
    const hit = changed === null || (e.surface?.length ? changed.some((f) => touches(f, e.surface)) : changed.length > 0);
    if (hit) return { ok: false, stale: true };
  }
  return { ok: true };
}

export function detectPhase({ state, facts, config }) {
  const skip = skipped(state, facts, config);
  const stale = [];
  // Evidence alone decides the phase. Commits never skip a phase: a failing reproduction
  // artifact is committed during phase 3, long before the plan or the implementation.
  const warnings = [];
  let phase = PHASES.length + 1;
  for (let i = 0; i < PHASES.length; i++) {
    const name = PHASES[i];
    if (skip.has(name)) continue;
    const r = check(name, state, facts, config);
    if (r.stale) stale.push(name);
    if (!r.ok) {
      phase = i + 1;
      break;
    }
  }
  return { phase, name: PHASES[phase - 1] ?? 'done', stale, skipped: [...skip], warnings };
}
