import { execFileSync } from 'node:child_process';

export const makeRunner = (cwd) => (cmd, args) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const UI = /\.(tsx|jsx|vue|svelte|css|scss|sass|less|html)$|(^|\/)(components|pages|routes|views|styles)\//;

const SHA = /^[0-9a-f]{7,64}$/i;
const isSha = (v) => typeof v === 'string' && SHA.test(v);

function attempt(run, args) {
  try {
    return run('git', args);
  } catch {
    return null;
  }
}

export function resolveBase(run) {
  const head = attempt(run, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head;
  for (const b of ['main', 'master', 'trunk']) {
    if (attempt(run, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]) !== null) return b;
  }
  return null;
}

export function gitFacts(run) {
  const branch = attempt(run, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const headSha = attempt(run, ['rev-parse', 'HEAD']);
  const base = resolveBase(run);
  const onBase = base !== null && (branch === base || `origin/${branch}` === base);
  let commitsAhead = 0;
  let lines = 0;
  const changedFiles = [];
  if (base && !onBase) {
    commitsAhead = Number(attempt(run, ['rev-list', '--count', `${base}..HEAD`]) ?? 0);
    const numstat = attempt(run, ['diff', '--numstat', '--no-renames', `${base}...HEAD`]) ?? '';
    for (const row of numstat.split('\n').filter(Boolean)) {
      const [added, deleted, ...name] = row.split('\t');
      lines += (Number(added) || 0) + (Number(deleted) || 0);
      changedFiles.push(name.join('\t'));
    }
  }
  return {
    branch,
    headSha,
    base,
    onBase,
    commitsAhead,
    changedFiles,
    diff: { lines, files: changedFiles.length },
    uiChanged: changedFiles.some((f) => UI.test(f)),
    dirty: (attempt(run, ['status', '--porcelain']) ?? '') !== '',
    remoteSha: branch && branch !== 'HEAD' ? attempt(run, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]) : null,
    branchExists: (name) => attempt(run, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]) !== null,
    isAncestor: (sha) => isSha(sha) && attempt(run, ['merge-base', '--is-ancestor', sha, 'HEAD']) !== null,
    commitsSince: (sha) => {
      if (sha !== 'EMPTY' && !isSha(sha)) return 0;
      return Number(attempt(run, ['rev-list', '--count', sha === 'EMPTY' ? 'HEAD' : `${sha}..HEAD`]) ?? 0);
    },
    changedSince: (sha) => {
      if (!isSha(sha)) return null;
      const out = attempt(run, ['diff', '--name-only', sha, 'HEAD']);
      return out === null ? null : out.split('\n').filter(Boolean);
    },
  };
}
