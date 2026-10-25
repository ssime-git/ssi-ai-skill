import { globToRegExp } from './stops.mjs';
import { riskyPath } from './guards.mjs';

export const targetOf = (state) => state.workflow?.target ?? 'pr';

// A small-task declaration can shorten the route, never weaken a risky actual diff.
export function isSmall(state, facts, config) {
  if (state.workflow?.scope !== 'small' || state.plan?.publicApi) return false;
  const files = [...new Set([...(state.plan?.touches ?? []), ...(facts.changedFiles ?? [])])];
  const protectedPaths = config.protectedPaths.map(globToRegExp);
  return files.length <= 3 && (facts.diff?.lines ?? 0) <= 80
    && !files.some((file) => riskyPath(file) || protectedPaths.some((pattern) => pattern.test(file)));
}

export function skippedPhases(state, facts, config) {
  if (targetOf(state) === 'answer') return new Set(['reproduce', 'plan', 'implement', 'review', 'visual', 'land']);
  const skipped = new Set();
  if (state.kind !== 'bug') skipped.add('reproduce');
  if (isSmall(state, facts, config)) {
    skipped.add('plan');
    skipped.add('review');
    if (state.kind !== 'bug') skipped.add('confirm');
  }
  if (targetOf(state) !== 'pr') skipped.add('land');
  const visual = config.visual.enabled;
  if (visual === 'off' || (visual === 'auto' && !facts.uiChanged)) skipped.add('visual');
  return skipped;
}
