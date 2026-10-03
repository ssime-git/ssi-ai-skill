import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo, commit, git } from '../helpers/repo.mjs';
import { makeGhStub } from '../helpers/gh.mjs';
import { makeRunner } from '../../skills/ssi/scripts/lib/git.mjs';
import { main } from '../../skills/ssi/scripts/lib/cli.mjs';

function cli(dir, gh) {
  return (...argv) => {
    let out = '';
    const code = main(argv, { cwd: dir, gh, run: makeRunner(dir), write: (s) => { out += s; } });
    return { code, json: out.trim().startsWith('{') ? JSON.parse(out) : out };
  };
}

function bugRunUntilReview(dir, gh, ssi) {
  ssi('start', 'Fix login crash');
  ssi('record', '--phase', '1', '--result', 'pass', '--gaps', '0', '--kind', 'bug', '--evidence', 'brief.md');
  ssi('record', '--phase', '2', '--result', 'pass', '--evidence', 'proof.txt');
  ssi('record', '--phase', '3', '--result', 'pass', '--evidence', 'repro.test.js');
  assert.equal(ssi('next').json.action.kind, 'open-issue');
  ssi('issue', 'create', '--title', 'Login crashes', '--body', 'details');
  ssi('record', '--phase', '4', '--result', 'pass', '--evidence', 'plan.md', '--touches', 'src/login.js');
  git(dir, 'checkout', '-q', '-b', 'ssi/fix-login');
  commit(dir, 'src/login.js', 'fixed\n', 'fix');
  assert.equal(ssi('next').json.action.kind, 'open-draft-pr');
  gh.openPr(1, 'ssi/fix-login');
  assert.equal(ssi('next').json.action.kind, 'verify-implementation');
  ssi('record', '--phase', '5', '--result', 'pass', '--evidence', 'tests.txt', '--surface', 'src');
  return ssi('next').json;
}

test('a bug goes through every phase to done, never merging', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  assert.equal(ssi('next').json.action.kind, 'start');
  assert.equal(ssi('next', '--style', 'adhd').code, 0);
  const review = bugRunUntilReview(dir, gh, ssi);
  assert.equal(review.name, 'review');
  assert.equal(review.say.where, '▓▓▓▓▓▓░░ 6/8 Review');
  assert.equal(gh.s.comments.length, 1);
  assert.equal(gh.s.issues.length, 1);
  ssi('record', '--phase', '6', '--result', 'pass', '--evidence', 'review.md', '--note', 'codex; independent: yes');
  assert.equal(ssi('next').json.action.kind, 'watch-ci');
  ssi('record', '--phase', '8', '--result', 'pass');
  const done = ssi('next').json;
  assert.equal(done.done, true);
  assert.match(done.action.instructions, /Do not merge/);
  assert.equal(ssi('allow', 'merge').code, 1);
});

test('heal: deleting the local notes restores them from the PR', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  rmSync(join(dir, '.ssi/state.json'));
  const out = ssi('next').json;
  assert.equal(out.name, 'review');
  assert.match(out.warnings.join(' '), /restored them from the PR/);
});

test('heal: a commit inside the surface makes earlier results stale, outside does not', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  commit(dir, 'docs/notes.md', 'x\n', 'docs');
  assert.equal(ssi('next').json.name, 'review');
  commit(dir, 'src/other.js', 'y\n', 'more code');
  const out = ssi('next').json;
  assert.equal(out.name, 'implement');
  assert.match(out.warnings.join(' '), /out of date/);
});

test('heal: a force-push is a reality stop, adopted only after an answer', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  git(dir, 'reset', '-q', '--hard', 'HEAD~1');
  commit(dir, 'src/redo.js', 'z\n', 'redo');
  const stopped = ssi('next').json;
  assert.equal(stopped.stop.code, 'STOP_REALITY');
  assert.equal(ssi('next').json.stop.code, 'STOP_REALITY');
  ssi('answer', 'A. adopt');
  assert.equal(ssi('next').json.stop, null);
});

test('a review that fails twice stops, and the answer gives it more rounds', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  ssi('record', '--phase', '6', '--result', 'fail');
  assert.equal(ssi('next').json.name, 'implement');
  ssi('record', '--phase', '5', '--result', 'pass', '--evidence', 't.txt', '--surface', 'src');
  ssi('record', '--phase', '6', '--result', 'fail');
  assert.equal(ssi('next').json.stop.code, 'STOP_REVIEW');
  ssi('answer', 'A. try again');
  assert.equal(ssi('next').json.stop, null);
});

test('starting on a branch that already has commits never skips analysis or jumps to a PR', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  git(dir, 'checkout', '-q', '-b', 'old-feature');
  commit(dir, 'src/one.js', '1\n', 'one');
  commit(dir, 'src/two.js', '2\n', 'two');
  ssi('start', 'Something new');
  assert.equal(ssi('next').json.name, 'analyze');
  ssi('record', '--phase', '1', '--result', 'pass', '--gaps', '0', '--kind', 'feature');
  ssi('record', '--phase', '2', '--result', 'pass');
  ssi('record', '--phase', '4', '--result', 'pass', '--touches', 'src/x.js');
  assert.equal(ssi('next').json.action.kind, 'implement');
  commit(dir, 'src/three.js', '3\n', 'three');
  assert.equal(ssi('next').json.action.kind, 'open-draft-pr');
});

test('the mandate comes from the repo config and blocks a step with a stop', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'ssi.config.json'), JSON.stringify({ mandate: { allow: ['issue', 'comment'] } }));
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  ssi('start', 'Add a flag');
  ssi('record', '--phase', '1', '--result', 'pass', '--gaps', '0', '--kind', 'feature');
  ssi('record', '--phase', '2', '--result', 'pass');
  ssi('record', '--phase', '4', '--result', 'pass', '--touches', 'src/a.js');
  git(dir, 'checkout', '-q', '-b', 'ssi/flag');
  commit(dir, 'src/a.js', '1\n', 'a');
  assert.equal(ssi('next').json.stop.code, 'STOP_OUT_OF_MANDATE');
  assert.equal(ssi('allow', 'push').code, 1);
  assert.equal(ssi('allow', 'issue').code, 0);
});

test('errors are clear JSON, never a crash', () => {
  const dir = makeRepo();
  const ssi = cli(dir, makeGhStub());
  assert.match(ssi('record', '--phase', '1', '--result', 'pass').json.error, /No active run/);
  ssi('start', 'x');
  assert.match(ssi('start', 'y').json.error, /already active/);
  assert.match(ssi('record', '--phase', '9', '--result', 'pass').json.error, /Unknown phase/);
  assert.match(ssi('answer', 'A').json.error, /no open question/);
  assert.equal(ssi('bogus').code, 2);
});
