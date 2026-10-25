import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

export const makeRunner = (cwd) => (cmd, args) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const UI = /\.(tsx|jsx|vue|svelte|css|scss|sass|less|html)$|(^|\/)(components|pages|routes|views|styles)\//;

const SHA = /^[0-9a-f]{7,64}$/i;
const isSha = (v) => typeof v === 'string' && SHA.test(v);

function attempt(run, args) {
  try {
    // core.quotePath=false keeps non-ASCII names readable (src/ж.js, not "src/\\320\\266.js").
    return run('git', ['-c', 'core.quotePath=false', ...args]);
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

export function gitFacts(run, { local = false, startSha = null } = {}) {
  const branch = attempt(run, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const headSha = attempt(run, ['rev-parse', 'HEAD']);
  const base = resolveBase(run);
  const onBase = base !== null && (branch === base || `origin/${branch}` === base);
  let commitsAhead = 0;
  let lines = 0;
  const changedFiles = [];
  if (local || (base && !onBase)) {
    commitsAhead = Number(attempt(run, ['rev-list', '--count', `${base}..HEAD`]) ?? 0);
    const localBase = isSha(startSha) ? startSha : base ?? headSha;
    const numstat = local && !headSha
      ? `${run('git', ['diff', '--numstat', '--no-renames'])}\n${run('git', ['diff', '--cached', '--numstat', '--no-renames'])}`
      : attempt(run, ['diff', '--numstat', '--no-renames', local ? localBase : `${base}...HEAD`]) ?? '';
    for (const row of numstat.split('\n').filter(Boolean)) {
      const [added, deleted, ...name] = row.split('\t');
      lines += (Number(added) || 0) + (Number(deleted) || 0);
      if (!changedFiles.includes(name.join('\t'))) changedFiles.push(name.join('\t'));
    }
  }
  let tree;
  if (local) {
    const hash = createHash('sha256');
    hash.update(headSha ?? 'EMPTY');
    hash.update(headSha ? run('git', ['diff', '--no-ext-diff', '--binary', 'HEAD'])
      : run('git', ['diff', '--no-ext-diff', '--binary']) + run('git', ['diff', '--cached', '--no-ext-diff', '--binary']));
    const root = run('git', ['rev-parse', '--show-toplevel']);
    for (const file of run('git', ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
      const path = join(root, file);
      const content = lstatSync(path).isSymbolicLink() ? Buffer.from(readlinkSync(path)) : readFileSync(path);
      hash.update(file + '\0').update(content).update('\0');
      if (!changedFiles.includes(file)) {
        changedFiles.push(file);
        lines += content.includes(0) ? 1 : content.toString('utf8').split('\n').length;
      }
    }
    tree = hash.digest('hex');
  }
  return {
    branch,
    headSha,
    tree,
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
