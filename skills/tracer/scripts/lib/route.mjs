import { globToRegExp } from './stops.mjs';
import { riskyPath } from './guards.mjs';

// Deterministic routing. The agent never decides which reviewers run or which model tier
// a step uses: these functions do, from the plan and the real diff.

export const TIERS = ['fast', 'balanced', 'deep'];

const UI = /\.(tsx|jsx|vue|svelte|css|scss|sass|less|html)$|(^|\/)(components|pages|routes|views|styles)\//;
const SECURITY = /(^|\/)(auth|security|crypto|sessions?|permissions?|payments?|secrets?)(\/|\.|$)|\.(pem|key)$/i;
const DATA = /(^|\/)(migrations?|schema[^/]*)(\/|$)|\.(sql|tf)$/i;

export function surfacesOf(files) {
  const has = (re) => files.some((f) => re.test(f));
  return { ui: has(UI), ux: has(UI), security: has(SECURITY), data: has(DATA) };
}

const filesOf = (state, facts) => [...new Set([...(state.plan?.touches ?? []), ...(facts.changedFiles ?? [])])];

export function riskOf(state, facts, config) {
  const files = filesOf(state, facts);
  const protectedPaths = config.protectedPaths.map(globToRegExp);
  const s = surfacesOf(files);
  if (state.plan?.publicApi || s.security || s.data || files.some((f) => riskyPath(f) || protectedPaths.some((p) => p.test(f)))) return 'high';
  const t = config.thresholds.diff;
  if ((facts.diff?.lines ?? 0) > t.lines / 2 || (facts.diff?.files ?? 0) > t.files / 2 || s.ui) return 'medium';
  return 'low';
}

// Roles beyond the general review. Each one must be covered by the report (`roles`).
export const ROLE_FOCUS = {
  ui: 'visual consistency with existing components, spacing and states (hover, focus, disabled, loading, error), responsive layout, accessibility (labels, contrast, keyboard)',
  ux: 'the user flow end to end: clear next step, empty and error states, wording, avoidable friction, destructive actions confirmed, nothing surprising',
  security: 'authorization and input handling, secrets, injection, unsafe defaults, data exposure',
  data: 'migration safety and rollback, data loss, locking, backward compatibility of schema and infrastructure changes',
};

export function reviewRoles(state, facts, config) {
  const s = surfacesOf(filesOf(state, facts));
  return Object.keys(ROLE_FOCUS).filter((r) => s[r] && config.review.roles.includes(r));
}

const bump = (tier, n = 1) => TIERS[Math.min(TIERS.indexOf(tier) + n, TIERS.length - 1)];

// Cheapest tier that fits the step, raised by risk and by earlier failures of the same step.
export function modelFor(step, state, facts, config) {
  let tier = config.models.steps[step] ?? 'balanced';
  const risk = riskOf(state, facts, config);
  if (risk === 'high' && ['plan', 'implement', 'review'].includes(step)) tier = bump(tier);
  if ((state.attempts?.[step] ?? 0) > 0) tier = bump(tier);
  return { tier, name: config.models.tiers[tier] || null, risk };
}

export const modelHint = (m) =>
  `Model for this step: ${m.name ?? m.tier} (${m.tier} tier, risk ${m.risk}). Use a sub-agent or model switch on that tier when your host supports it; otherwise continue as you are.`;
