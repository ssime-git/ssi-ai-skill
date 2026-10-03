import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo, commit, git } from '../helpers/repo.mjs';
import { makeRunner, gitFacts, resolveBase } from '../../skills/ssi/scripts/lib/git.mjs';

const facts = (dir) => gitFacts(makeRunner(dir));

test('base resolves to main and a fresh branch has nothing ahead', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  const f = facts(dir);
  assert.equal(f.base, 'main');
  assert.equal(f.onBase, false);
  assert.equal(f.commitsAhead, 0);
});

test('on the base branch nothing counts as ahead', () => {
  const f = facts(makeRepo());
  assert.equal(f.onBase, true);
  assert.equal(f.commitsAhead, 0);
});

test('counts commits, changed lines, files and UI surface', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  commit(dir, 'src/a.js', '1\n2\n3\n', 'a');
  commit(dir, 'src/components/B.tsx', 'x\n', 'b');
  const f = facts(dir);
  assert.equal(f.commitsAhead, 2);
  assert.equal(f.diff.files, 2);
  assert.equal(f.diff.lines, 4);
  assert.equal(f.uiChanged, true);
  assert.deepEqual(f.changedFiles.sort(), ['src/a.js', 'src/components/B.tsx']);
});

test('a file renamed into a protected folder is reported by its real paths', () => {
  const dir = makeRepo();
  commit(dir, 'src/ordinary/login.js', 'line one\nline two\nline three\nline four\n', 'seed');
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  mkdirSync(join(dir, 'src/auth'), { recursive: true });
  git(dir, 'mv', 'src/ordinary/login.js', 'src/auth/login.js');
  git(dir, 'commit', '-q', '-am', 'move');
  const f = facts(dir);
  assert.ok(f.changedFiles.includes('src/auth/login.js'), f.changedFiles.join(','));
  assert.ok(f.changedFiles.includes('src/ordinary/login.js'));
  assert.ok(f.changedFiles.every((p) => !p.includes('=>')));
});

test('a non-UI change does not flag the UI', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  commit(dir, 'src/a.js', '1\n', 'a');
  assert.equal(facts(dir).uiChanged, false);
});

test('base comes from origin/HEAD when it is set, never assumed', () => {
  const dir = makeRepo();
  git(dir, 'update-ref', 'refs/remotes/origin/trunk', 'HEAD');
  git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  assert.equal(resolveBase(makeRunner(dir)), 'origin/trunk');
});

test('isAncestor detects a rewritten history', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  const old = commit(dir, 'src/a.js', '1\n', 'a');
  git(dir, 'reset', '-q', '--hard', 'HEAD~1');
  commit(dir, 'src/c.js', 'z\n', 'c');
  assert.equal(facts(dir).isAncestor(old), false);
});

test('changedSince lists files and gives null for an unknown sha', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  const first = commit(dir, 'src/a.js', '1\n', 'a');
  commit(dir, 'src/b.js', '2\n', 'b');
  const f = facts(dir);
  assert.deepEqual(f.changedSince(first), ['src/b.js']);
  assert.equal(f.changedSince('deadbeef'), null);
  assert.equal(f.branchExists('ssi/x'), true);
  assert.equal(f.branchExists('nope'), false);
});

test('commitsSince counts from the start sha; an unknown start counts nothing', () => {
  const dir = makeRepo();
  const start = git(dir, 'rev-parse', 'HEAD');
  commit(dir, 'a.js', '1\n', 'a');
  commit(dir, 'b.js', '2\n', 'b');
  const f = facts(dir);
  assert.equal(f.commitsSince(start), 2);
  assert.equal(f.commitsSince(null), 0);
  assert.equal(f.commitsSince('EMPTY'), 3);
  assert.equal(f.commitsSince('deadbeef'), 0);
});

test('remoteSha follows the remote-tracking ref of the current branch', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  assert.equal(facts(dir).remoteSha, null);
  git(dir, 'update-ref', 'refs/remotes/origin/ssi/x', 'HEAD');
  assert.equal(facts(dir).remoteSha, git(dir, 'rev-parse', 'HEAD'));
});

test('a sha that is not hex is never passed to git', () => {
  const f = facts(makeRepo());
  assert.equal(f.changedSince('--output=/tmp/ssi-pwn'), null);
  assert.equal(f.isAncestor('--all'), false);
  assert.equal(f.commitsSince('--all'), 0);
});

test('a detached HEAD does not throw', () => {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '--detach');
  const f = facts(dir);
  assert.equal(f.branch, 'HEAD');
  assert.equal(typeof f.headSha, 'string');
});
