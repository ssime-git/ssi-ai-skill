import { mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { makeRunner } from './git.mjs';

export function rawUrl(remoteUrl, branch, path) {
  const m = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl.trim());
  // github.com/.../blob/...?raw=true renders in PRs of private repos for signed-in members;
  // raw.githubusercontent.com does not (it needs a token), so it is never used.
  return m ? `https://github.com/${m[1]}/${m[2]}/blob/${branch}/${path}?raw=true` : null;
}

export function planPurge(closed, paths) {
  const gone = new Set(closed.map((n) => `pr-${n}/`));
  return paths.filter((p) => gone.has(p.slice(0, p.indexOf('/') + 1)));
}

function assertSafeBranch(branch, forbid = []) {
  if (forbid.includes(branch)) throw new Error(`The assets branch "${branch}" is a source branch. Choose another one with assets.branch.`);
}

function ok(run, args) {
  try {
    run('git', args);
    return true;
  } catch {
    return false;
  }
}

// The assets branch is only ever written by this tool and every operation is idempotent,
// so the remote copy wins: fetch it first and reset the local branch onto it.
function withTree({ run, makeRun, branch }, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ssi-assets-'));
  ok(run, ['fetch', '-q', 'origin', `${branch}:refs/remotes/origin/${branch}`]);
  if (ok(run, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`])) {
    run('git', ['worktree', 'add', '-B', branch, dir, `origin/${branch}`]);
  } else if (ok(run, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])) {
    run('git', ['worktree', 'add', '--force', dir, branch]);
  } else {
    run('git', ['worktree', 'add', '--detach', dir]);
    const w = makeRun(dir);
    w('git', ['checkout', '--orphan', branch]);
    ok(w, ['rm', '-rf', '--quiet', '.']);
  }
  try {
    return fn(makeRun(dir), dir);
  } finally {
    ok(run, ['worktree', 'remove', '--force', dir]);
  }
}

function commitAll(w, message) {
  if (ok(w, ['diff', '--cached', '--quiet'])) return false;
  const identity = ok(w, ['config', 'user.email']) ? [] : ['-c', 'user.name=ssi', '-c', 'user.email=ssi@users.noreply.github.com'];
  w('git', [...identity, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message]);
  return true;
}

export function uploadAsset({ run, makeRun = makeRunner, branch, pr, file, push, forbid = [] }) {
  assertSafeBranch(branch, forbid);
  const rel = `pr-${pr}/${basename(file)}`;
  withTree({ run, makeRun, branch }, (w, dir) => {
    mkdirSync(join(dir, `pr-${pr}`), { recursive: true });
    copyFileSync(file, join(dir, rel));
    w('git', ['add', rel]);
    commitAll(w, `ssi: evidence for PR #${pr}`);
    if (push) w('git', ['push', '-q', 'origin', `${branch}:${branch}`]);
  });
  let remote = null;
  try {
    remote = run('git', ['remote', 'get-url', 'origin']);
  } catch {
    remote = null;
  }
  const url = remote ? rawUrl(remote, branch, rel) : null;
  return { path: rel, url, markdown: url ? `![demo](${url})` : null, pushed: !!push };
}

export function purgeAssets({ run, makeRun = makeRunner, branch, closed, push, dryRun, forbid = [] }) {
  assertSafeBranch(branch, forbid);
  let paths = null;
  ok(run, ['fetch', '-q', 'origin', `${branch}:refs/remotes/origin/${branch}`]);
  for (const ref of [`origin/${branch}`, branch]) {
    try {
      paths = run('git', ['-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', ref]).split('\n').filter(Boolean);
      break;
    } catch {
      paths = null;
    }
  }
  if (!paths) return { removed: [] };
  const removed = planPurge(closed, paths);
  if (!removed.length || dryRun) return { removed, dryRun: !!dryRun };
  withTree({ run, makeRun, branch }, (w) => {
    w('git', ['rm', '-q', '-r', ...new Set(removed.map((p) => p.split('/')[0]))]);
    commitAll(w, 'ssi: purge evidence of closed PRs');
    if (push) w('git', ['push', '-q', 'origin', `${branch}:${branch}`]);
  });
  return { removed, dryRun: false };
}
