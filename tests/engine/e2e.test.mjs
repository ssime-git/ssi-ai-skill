import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, commit } from '../helpers/repo.mjs';
import { session, reach } from '../helpers/session.mjs';
import { readState } from '../../skills/ssi/scripts/lib/state.mjs';

test('small local work is verified without commits, GitHub or an Issue', () => {
  const { dir, ssi, gh, record } = session();
  assert.equal(ssi('start', 'Add a discount helper', '--scope', 'small').code, 0);
  record(1, '--kind', 'feature', '--gaps', '0');
  assert.equal(ssi('next').json.action.kind, 'implement-local');
  writeFileSync(join(dir, 'calc.cjs'), 'exports.total = (n, pct) => n * (1 - pct / 100);\n');
  const result = ssi('check', '--phase', '5', '--', 'node', '-e', "require('node:assert/strict').equal(require('./calc.cjs').total(100, 20), 80)");
  assert.equal(result.code, 0, JSON.stringify(result.json));
  assert.equal(ssi('next', '--compact').json.done, true);
  assert.equal(gh.s.calls.length, 0);
  assert.equal(git(dir, 'rev-list', '--count', 'HEAD'), '1');
  const proof = readState(dir).state.evidence.implement;
  assert.equal(proof.level, 'executed');
  assert.equal(JSON.parse(readFileSync(proof.path)).exitCode, 0);
  writeFileSync(join(dir, 'calc.cjs'), 'exports.total = () => 0;\n');
  assert.equal(ssi('next').json.phase, 5, 'uncommitted edits invalidate verification');
});

test('answer route stops after its conclusion and never calls GitHub', () => {
  const { ssi, gh, record } = session();
  ssi('start', 'Explain total', '--target', 'answer');
  record(1, '--kind', 'feature'); record(2);
  assert.equal(ssi('next').json.done, true);
  assert.equal(gh.s.calls.length, 0);
  assert.equal(ssi('start', 'Next question', '--target', 'answer').code, 0);
});

test('a small bug still needs confirmation and reproduction, but no Issue', () => {
  const { dir, ssi, gh, record } = session();
  ssi('start', 'Fix calculation', '--scope', 'small'); record(1, '--kind', 'bug');
  assert.equal(ssi('next').json.phase, 2);
  for (const phase of ['2', '3']) assert.equal(ssi('check', '--phase', phase, '--expect-exit', '1', '--', 'node', '-e', 'process.exit(1)').code, 0);
  assert.equal(ssi('next').json.action.kind, 'implement-local');
  writeFileSync(join(dir, 'fix.cjs'), 'module.exports = 80;\n');
  const verified = ssi('check', '--', 'node', '-e', "require('node:assert/strict').equal(require('./fix.cjs'), 80)");
  assert.equal(verified.code, 0, JSON.stringify(verified.json));
  assert.equal(ssi('next').json.done, true, 'fixing the bug must not invalidate its pre-fix reproduction');
  assert.equal(gh.s.issues.length, 0);
});

test('PR route keeps review, exact-head CI and draft status', () => {
  const { ssi, gh, record } = reach(6);
  record(6); record(7);
  assert.equal(ssi('next').json.action.kind, 'watch-ci');
  gh.s.checks = [{ __typename: 'CheckRun', name: 'tests', status: 'COMPLETED', conclusion: 'SUCCESS' }];
  assert.equal(ssi('ci').json.pass, true);
  assert.equal(ssi('next').json.done, true);
  assert.equal(gh.s.pr.isDraft, true);
  assert.equal(gh.s.issues.length, 0);
  assert.equal(ssi('allow', 'merge').code, 1);
});

test('CI pending, failing and wrong-head states never pass', () => {
  const { dir, ssi, gh, record, check } = reach(8);
  gh.s.checks = [{ __typename: 'CheckRun', status: 'IN_PROGRESS' }];
  assert.equal(ssi('ci').json.pending, true);
  gh.s.checks = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }];
  assert.equal(ssi('ci').json.pass, false);
  assert.equal(ssi('next').json.phase, 5);
  check(); record(6); record(7);
  gh.s.pr.sha = 'wrong-head';
  assert.match(ssi('ci').json.error, /does not point/);
  gh.s.pr.sha = git(dir, 'rev-parse', 'HEAD');
});

test('absent CI is disclosed, never described as checks green', () => {
  const { ssi } = reach(8);
  const r = ssi('ci');
  assert.equal(r.code, 0);
  assert.equal(r.json.checks, 0);
  assert.match(r.json.note, /CI unverified/);
});

test('missing, empty and blocking review reports are refused', () => {
  const { ssi, artifact } = reach(6);
  const args = ['record', '--phase', '6', '--result', 'pass', '--note', 'reviewer; independent: no'];
  assert.match(ssi(...args, '--evidence', '/ssi-no-such-report').json.error, /ENOENT/);
  assert.match(ssi(...args, '--evidence', artifact('empty', '')).json.error, /empty/);
  const file = artifact('blocking.json', { verdict: 'approve', summary: 'Unsafe', findings: [{ severity: 'high' }] });
  assert.match(ssi(...args, '--evidence', file).json.error, /blocking review/);
});

test('manual notes cannot impersonate executed tests or CI, or skip phases', () => {
  const { ssi } = session(); ssi('start', 'x');
  assert.match(ssi('record', '--phase', '5', '--result', 'pass').json.error, /Use ssi check/);
  assert.match(ssi('record', '--phase', '8', '--result', 'pass', '--note', 'checks green').json.error, /Use ssi ci/);
  assert.match(ssi('check', '--phase', '5', '--', 'node', '--version').json.error, /not current/);
});

test('runner errors are not expected reproduction failures', () => {
  const { ssi, record } = session();
  ssi('start', 'Fix x', '--scope', 'small'); record(1, '--kind', 'bug');
  const r = ssi('check', '--phase', '2', '--expect-exit', '1', '--', 'ssi-no-such-executable');
  assert.equal(r.code, 1); assert.equal(r.json.pass, false);
});

test('deleted state heals from the PR with an explicit PR destination', () => {
  const { dir, ssi } = reach(6); ssi('next');
  rmSync(join(dir, '.ssi/state.json'));
  const out = ssi('next', '--target', 'pr').json;
  assert.equal(out.name, 'review'); assert.match(out.warnings.join(' '), /restored/);
});

test('commits invalidate verification and need a push before review', () => {
  const { dir, ssi, check } = reach(6);
  commit(dir, 'src/calc.js', 'export const total = () => 2;\n', 'follow-up');
  assert.equal(ssi('next').json.phase, 5); check();
  assert.equal(ssi('next').json.action.kind, 'push-changes');
});

test('opt-in issues are deduplicated, including offline retries', () => {
  const { ssi, gh } = session(); ssi('start', 'Investigate follow-up');
  gh.s.offline = true;
  assert.equal(ssi('issue', 'create', '--title', 'Follow-up', '--body', 'Evidence and next step').json.queued, true);
  gh.s.offline = false; ssi('next');
  ssi('issue', 'create', '--title', 'Follow-up', '--body', 'Evidence and next step');
  assert.equal(gh.s.issues.length, 1);
});

test('protected changes promote small routes and require an answer', () => {
  const { dir, ssi, record } = session();
  ssi('start', 'Small helper', '--scope', 'small'); record(1, '--kind', 'feature');
  commit(dir, 'src/auth/login.js', 'export const login = () => true;\n', 'auth');
  assert.equal(ssi('next').json.phase, 2); record(2);
  record(4, '--touches', 'src/auth/login.js');
  assert.equal(ssi('next').json.stop.code, 'STOP_PROTECTED');
  assert.match(ssi('answer', 'No, stop').json.error, /letter/);
  assert.equal(ssi('next').json.stop.code, 'STOP_PROTECTED');
  ssi('answer', 'A. User approved'); assert.equal(ssi('next').json.stop, null);
});

test('Open items prevent PR completion until resolved', () => {
  const { ssi, gh } = reach(8); ssi('ci');
  gh.s.pr.body = '## Open items\n- [ ] inspect edge case';
  assert.equal(ssi('next').json.action.kind, 'close-open-items');
  gh.s.pr.body = '## Open items\n- [x] inspect edge case';
  assert.equal(ssi('next').json.done, true);
});

test('compact output preserves instructions without presentation duplication', () => {
  const { ssi } = session(); ssi('start', 'Small task', '--scope', 'small');
  const full = ssi('next').json, compact = ssi('next', '--compact').json;
  assert.equal(compact.action.instructions, full.action.instructions);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(full).length);
});
