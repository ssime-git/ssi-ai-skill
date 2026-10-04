import { createHash } from 'node:crypto';

const KEEP = ['updated_at', 'run_id', 'goal', 'kind', 'branch', 'head_sha', 'start_sha', 'work_sha', 'issue', 'issue_skipped', 'last_failure', 'pr', 'phase', 'evidence', 'attempts', 'analysis', 'plan', 'approvals', 'stop'];
const BEGIN = '<!-- ssi:begin -->';
const END = '<!-- ssi:end -->';

const slim = (state) => Object.fromEntries(KEEP.map((k) => [k, state[k]]));
const escape = (s) => s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

export function renderBlock(state, header) {
  return `${BEGIN}\n${header}\n\n<!-- ssi:state ${escape(JSON.stringify(slim(state)))} -->\n${END}`;
}

export function parseBlock(body) {
  const m = /<!-- ssi:state (\{[\s\S]*?\}) -->/.exec(body ?? '');
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function mergeComment(existing, block) {
  if (!existing) return block;
  const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}`);
  return re.test(existing) ? existing.replace(re, () => block) : `${existing}\n\n${block}`;
}

// updated_at moves on every write; it must not make the state look changed.
const HASHED = KEEP.filter((k) => k !== 'updated_at');
export const stateHash = (state) =>
  createHash('sha1').update(JSON.stringify(Object.fromEntries(HASHED.map((k) => [k, state[k]])))).digest('hex');
