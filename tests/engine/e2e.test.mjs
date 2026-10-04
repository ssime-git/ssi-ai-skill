import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
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

test('a reproduction commit made during phase 3 skips neither the plan nor the implementation', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  ssi('start', 'Fix crash');
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  commit(dir, 'test/repro.test.js', 'failing\n', 'repro');
  ssi('record', '--phase', '1', '--result', 'pass', '--gaps', '0', '--kind', 'bug');
  ssi('record', '--phase', '2', '--result', 'pass');
  ssi('record', '--phase', '3', '--result', 'pass', '--evidence', 'test/repro.test.js');
  assert.equal(ssi('next').json.action.kind, 'open-issue');
  ssi('issue', 'create', '--title', 'Crash', '--body', 'b');
  assert.equal(ssi('next').json.name, 'plan');
  ssi('record', '--phase', '4', '--result', 'pass', '--touches', 'src/x.js');
  assert.equal(ssi('next').json.action.kind, 'implement');
  commit(dir, 'src/x.js', 'fix\n', 'fix');
  assert.equal(ssi('next').json.action.kind, 'open-draft-pr');
});

test('after a failed review the run asks for a fix, not for the same tests again', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  ssi('record', '--phase', '6', '--result', 'fail');
  assert.equal(ssi('next').json.action.kind, 'implement');
  commit(dir, 'src/login.js', 'better\n', 'address review');
  assert.equal(ssi('next').json.action.kind, 'verify-implementation');
});

test('switching to another branch never writes this run into that branch\'s PR', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  const before = gh.s.comments.map((c) => c.body);
  git(dir, 'checkout', '-q', 'main');
  git(dir, 'checkout', '-q', '-b', 'other');
  commit(dir, 'src/o.js', 'o\n', 'other work');
  gh.openPr(2, 'other');
  const calls = gh.s.calls.length;
  const out = ssi('next').json;
  assert.equal(out.stop.code, 'STOP_REALITY');
  assert.deepEqual(gh.s.comments.map((c) => c.body), before);
  assert.equal(gh.s.calls.slice(calls).some((c) => c.includes('-f')), false);
  assert.equal(JSON.parse(readFileSync(join(dir, '.ssi/state.json'), 'utf8')).pr, 1);
});

test('ssi issue skip drops a queued Issue creation, so it is not created later', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  ssi('start', 'Bug');
  gh.s.offline = true;
  assert.equal(ssi('issue', 'create', '--title', 'T', '--body', 'b').json.queued, true);
  ssi('issue', 'skip', '--because', 'Issues are disabled');
  gh.s.offline = false;
  ssi('next');
  assert.equal(gh.s.issues.length, 0);
});

test('a closed PR is adopted with an answer and does not come back as a stop', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  gh.s.pr.state = 'CLOSED';
  assert.match(ssi('next').json.stop.because, /closed/);
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

test('a fix committed after a failed review is pushed before the next review', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  gh.s.pr.sha = git(dir, 'rev-parse', 'HEAD');
  ssi('record', '--phase', '6', '--result', 'fail');
  commit(dir, 'src/login.js', 'better\n', 'address review');
  ssi('record', '--phase', '5', '--result', 'pass', '--evidence', 't.txt', '--surface', 'src');
  const out = ssi('next').json;
  assert.equal(out.action.kind, 'push-changes');
  gh.s.pr.sha = git(dir, 'rev-parse', 'HEAD');
  assert.equal(ssi('next').json.action.kind, 'review');
});

test('a reply that is not A or B is refused and the question stays open', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  ssi('start', 'Touch auth');
  ssi('record', '--phase', '1', '--result', 'pass', '--gaps', '0', '--kind', 'feature');
  ssi('record', '--phase', '2', '--result', 'pass');
  ssi('record', '--phase', '4', '--result', 'pass', '--touches', 'src/auth/login.js');
  assert.equal(ssi('next').json.stop.code, 'STOP_PROTECTED');
  assert.match(ssi('answer', 'No, do not touch auth').json.error, /letter of an option/);
  assert.equal(ssi('next').json.stop.code, 'STOP_PROTECTED');
  ssi('answer', 'A. approved by the user');
  assert.equal(ssi('next').json.stop, null);
});

test('issue skip lets a bug go on when issues are impossible; a bad title is an error, not a queue', () => {
  const dir = makeRepo();
  const ssi = cli(dir, makeGhStub());
  ssi('start', 'Bug');
  ssi('record', '--phase', '1', '--result', 'pass', '--gaps', '0', '--kind', 'bug');
  ssi('record', '--phase', '2', '--result', 'pass');
  ssi('record', '--phase', '3', '--result', 'pass', '--evidence', 'r.js');
  assert.match(ssi('issue', 'create').json.error, /--title is required/);
  assert.equal(ssi('next').json.action.kind, 'open-issue');
  ssi('issue', 'skip', '--because', 'Issues are disabled');
  assert.equal(ssi('next').json.name, 'plan');
});

test('a passing proof is refused while changes are uncommitted, and accepted once committed', () => {
  const dir = makeRepo();
  const ssi = cli(dir, makeGhStub());
  ssi('start', 'x');
  writeFileSync(join(dir, 'loose.js'), 'x\n');
  assert.match(ssi('record', '--phase', '5', '--result', 'pass', '--evidence', 't').json.error, /uncommitted/);
  assert.match(ssi('record', '--phase', '6', '--result', 'pass', '--evidence', 't').json.error, /uncommitted/);
  assert.equal(ssi('record', '--phase', '5', '--result', 'fail').code, 0);
  git(dir, 'add', 'loose.js');
  git(dir, 'commit', '-q', '-m', 'loose');
  assert.equal(ssi('record', '--phase', '5', '--result', 'pass', '--evidence', 't').code, 0);
});

test('an older local cache never overwrites newer progress made on another machine', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  bugRunUntilReview(dir, gh, ssi);
  const stale = JSON.parse(readFileSync(join(dir, '.ssi/state.json'), 'utf8'));
  stale.updated_at = '2000-01-01T00:00:00.000Z';
  ssi('record', '--phase', '6', '--result', 'pass', '--evidence', 'review.md');
  ssi('record', '--phase', '8', '--result', 'pass');
  assert.equal(ssi('next').json.done, true);
  writeFileSync(join(dir, '.ssi/state.json'), JSON.stringify(stale));
  const out = ssi('next').json;
  assert.equal(out.done, true);
  assert.match(out.warnings.join(' '), /newer progress/);
  assert.match(gh.s.comments[0].body, /"land"/);
});
