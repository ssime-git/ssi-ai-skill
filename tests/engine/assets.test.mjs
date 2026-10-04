import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeRepo, git } from '../helpers/repo.mjs';
import { makeRunner } from '../../skills/ssi/scripts/lib/git.mjs';
import { rawUrl, planPurge, uploadAsset, purgeAssets } from '../../skills/ssi/scripts/lib/assets.mjs';

const gif = (name = 'demo.gif') => {
  const p = join(mkdtempSync(join(tmpdir(), 'ssi-gif-')), name);
  writeFileSync(p, 'GIF89a');
  return p;
};
const tree = (dir) => git(dir, 'ls-tree', '-r', '--name-only', 'ssi-assets').split('\n').filter(Boolean).sort();

test('the link works for private repos: github.com blob ?raw=true, never raw.githubusercontent', () => {
  const want = 'https://github.com/o/r/blob/ssi-assets/pr-7/demo.gif?raw=true';
  assert.equal(rawUrl('https://github.com/o/r.git', 'ssi-assets', 'pr-7/demo.gif'), want);
  assert.equal(rawUrl('git@github.com:o/r.git', 'ssi-assets', 'pr-7/demo.gif'), want);
  assert.equal(rawUrl('/local/path', 'ssi-assets', 'x'), null);
});

test('upload and purge refuse to touch the base branch or the current branch', () => {
  const dir = makeRepo();
  const run = makeRunner(dir);
  assert.throws(() => uploadAsset({ run, branch: 'main', pr: 1, file: gif(), push: false, forbid: ['main'] }), /source branch/);
  assert.throws(() => purgeAssets({ run, branch: 'ssi/x', closed: [1], push: false, dryRun: false, forbid: ['ssi/x'] }), /source branch/);
  assert.deepEqual(git(dir, 'ls-tree', '-r', '--name-only', 'main').split('\n'), ['README.md']);
});

test('planPurge keeps open PRs and removes closed ones', () => {
  assert.deepEqual(planPurge([1], ['pr-1/a.gif', 'pr-2/b.gif', 'pr-10/c.gif']), ['pr-1/a.gif']);
});

test('upload creates the orphan branch without touching main, then reuses it', () => {
  const dir = makeRepo();
  git(dir, 'remote', 'add', 'origin', 'https://github.com/o/r.git');
  const run = makeRunner(dir);
  const a = uploadAsset({ run, branch: 'ssi-assets', pr: 7, file: gif(), push: false });
  assert.equal(a.url, 'https://github.com/o/r/blob/ssi-assets/pr-7/demo.gif?raw=true');
  assert.match(a.markdown, /^!\[demo\]\(https:/);
  assert.deepEqual(tree(dir), ['pr-7/demo.gif']);
  assert.deepEqual(git(dir, 'ls-tree', '-r', '--name-only', 'main').split('\n'), ['README.md']);
  uploadAsset({ run, branch: 'ssi-assets', pr: 8, file: gif('two.gif'), push: false });
  assert.deepEqual(tree(dir), ['pr-7/demo.gif', 'pr-8/two.gif']);
  assert.equal(git(dir, 'branch', '--show-current'), 'main');
  assert.equal(git(dir, 'worktree', 'list').split('\n').length, 1);
});

test('purge removes only closed PRs, and a dry run changes nothing', () => {
  const dir = makeRepo();
  const run = makeRunner(dir);
  uploadAsset({ run, branch: 'ssi-assets', pr: 1, file: gif('a.gif'), push: false });
  uploadAsset({ run, branch: 'ssi-assets', pr: 2, file: gif('b.gif'), push: false });
  const dry = purgeAssets({ run, branch: 'ssi-assets', closed: [1], push: false, dryRun: true });
  assert.deepEqual(dry.removed, ['pr-1/a.gif']);
  assert.deepEqual(tree(dir), ['pr-1/a.gif', 'pr-2/b.gif']);
  purgeAssets({ run, branch: 'ssi-assets', closed: [1], push: false, dryRun: false });
  assert.deepEqual(tree(dir), ['pr-2/b.gif']);
});

test('purge with no assets branch is a no-op', () => {
  const dir = makeRepo();
  assert.deepEqual(purgeAssets({ run: makeRunner(dir), branch: 'ssi-assets', closed: [1], push: false, dryRun: false }), { removed: [] });
});

const bare = () => {
  const d = mkdtempSync(join(tmpdir(), 'ssi-origin-'));
  git(d, 'init', '-q', '--bare', '-b', 'main');
  return d;
};

test('upload is retryable: same file twice is fine, and a missed push is completed', () => {
  const dir = makeRepo();
  git(dir, 'remote', 'add', 'origin', bare());
  const run = makeRunner(dir);
  const f = gif();
  uploadAsset({ run, branch: 'ssi-assets', pr: 3, file: f, push: false });
  uploadAsset({ run, branch: 'ssi-assets', pr: 3, file: f, push: true });
  assert.equal(git(dir, 'ls-remote', '--heads', 'origin', 'ssi-assets').split('\n').length, 1);
  assert.deepEqual(tree(dir), ['pr-3/demo.gif']);
});

test('a stale local assets branch never blocks the push: the remote copy wins', () => {
  const origin = bare();
  const a = makeRepo();
  git(a, 'remote', 'add', 'origin', origin);
  uploadAsset({ run: makeRunner(a), branch: 'ssi-assets', pr: 1, file: gif('one.gif'), push: true });
  const b = makeRepo();
  git(b, 'remote', 'add', 'origin', origin);
  uploadAsset({ run: makeRunner(b), branch: 'ssi-assets', pr: 2, file: gif('two.gif'), push: true });
  uploadAsset({ run: makeRunner(a), branch: 'ssi-assets', pr: 3, file: gif('three.gif'), push: true });
  const remote = git(a, 'ls-tree', '-r', '--name-only', 'origin/ssi-assets').split('\n').sort();
  assert.deepEqual(remote, ['pr-1/one.gif', 'pr-2/two.gif', 'pr-3/three.gif']);
});

test('purge looks at the remote tree, not a stale local assets branch', () => {
  const origin = bare();
  const a = makeRepo();
  git(a, 'remote', 'add', 'origin', origin);
  uploadAsset({ run: makeRunner(a), branch: 'ssi-assets', pr: 1, file: gif('one.gif'), push: true });
  const b = makeRepo();
  git(b, 'remote', 'add', 'origin', origin);
  uploadAsset({ run: makeRunner(b), branch: 'ssi-assets', pr: 2, file: gif('two.gif'), push: true });
  const out = purgeAssets({ run: makeRunner(a), branch: 'ssi-assets', closed: [2], push: true, dryRun: false });
  assert.deepEqual(out.removed, ['pr-2/two.gif']);
  assert.deepEqual(git(a, 'ls-tree', '-r', '--name-only', 'origin/ssi-assets').split('\n'), ['pr-1/one.gif']);
});
