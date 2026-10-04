import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const PHASES = ['analyze', 'confirm', 'reproduce', 'plan', 'implement', 'review', 'visual', 'land'];

export const statePath = (cwd) => join(cwd, '.ssi', 'state.json');

export function newState(goal) {
  return {
    run_id: `ssi-${randomBytes(3).toString('hex')}`,
    goal,
    kind: null,
    branch: null,
    head_sha: null,
    start_sha: null,
    work_sha: null,
    issue: null,
    issue_skipped: null,
    last_failure: null,
    pr: null,
    phase: 1,
    evidence: {},
    attempts: {},
    analysis: { blockingGaps: 0 },
    plan: { touches: [], publicApi: false },
    approvals: { protectedFiles: [], publicApi: false, bigDiff: null },
    stop: null,
    pending: [],
    synced: null,
    updated_at: new Date().toISOString(),
  };
}

export function normalize(state) {
  const base = newState(state.goal ?? '');
  const approvals = { ...base.approvals, ...(state.approvals ?? {}) };
  if (!Array.isArray(approvals.protectedFiles)) approvals.protectedFiles = [];
  if (typeof approvals.bigDiff !== 'object') approvals.bigDiff = null;
  return {
    ...base,
    ...state,
    evidence: state.evidence ?? {},
    attempts: state.attempts ?? {},
    analysis: { ...base.analysis, ...state.analysis },
    plan: { ...base.plan, ...state.plan },
    approvals,
    pending: state.pending ?? [],
  };
}

export function readState(cwd) {
  let text;
  try {
    text = readFileSync(statePath(cwd), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { state: null };
    throw e;
  }
  try {
    return { state: normalize(JSON.parse(text)) };
  } catch {
    return { state: null, warning: 'My local notes were unreadable, so I am rebuilding them from git and the PR.' };
  }
}

export function writeState(cwd, state) {
  const dir = join(cwd, '.ssi');
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  state.updated_at = new Date().toISOString();
  const tmp = join(dir, `state.json.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  renameSync(tmp, statePath(cwd));
}
