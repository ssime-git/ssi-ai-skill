const ETA = { analyze: 3, confirm: 4, reproduce: 8, plan: 5, implement: 15, review: 8, visual: 6, land: 10 };
const label = (name) => name[0].toUpperCase() + name.slice(1);

export const bar = (phase) => {
  const p = Math.max(0, Math.min(phase, 8));
  return '▓'.repeat(p) + '░'.repeat(8 - p);
};

export function say({ phase, name, next, style, needsUser, done }) {
  if (style === 'plain') return null;
  const where = done ? `${bar(8)} 8/8 Done` : `${bar(phase)} ${phase}/8 ${label(name)}`;
  const out = { where, next, needs_user: needsUser };
  if (style === 'adhd' && !done && ETA[name]) out.eta = `~${ETA[name]} min`;
  return out;
}
