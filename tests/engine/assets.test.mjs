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

test('rawUrl handles https and ssh remotes and rejects others', () => {
  const want = 'https://raw.githubusercontent.com/o/r/ssi-assets/pr-7/demo.gif';
  assert.equal(rawUrl('https://github.com/o/r.git', 'ssi-assets', 'pr-7/demo.gif'), want);
  assert.equal(rawUrl('git@github.com:o/r.git', 'ssi-assets', 'pr-7/demo.gif'), want);
  assert.equal(rawUrl('/local/path', 'ssi-assets', 'x'), null);
});

test('planPurge keeps open PRs and removes closed ones', () => {
  assert.deepEqual(planPurge([1], ['pr-1/a.gif', 'pr-2/b.gif', 'pr-10/c.gif']), ['pr-1/a.gif']);
});

test('upload creates the orphan branch without touching main, then reuses it', () => {
  const dir = makeRepo();
  git(dir, 'remote', 'add', 'origin', 'https://github.com/o/r.git');
  const run = makeRunner(dir);
  const a = uploadAsset({ run, branch: 'ssi-assets', pr: 7, file: gif(), push: false });
  assert.equal(a.url, 'https://raw.githubusercontent.com/o/r/ssi-assets/pr-7/demo.gif');
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
