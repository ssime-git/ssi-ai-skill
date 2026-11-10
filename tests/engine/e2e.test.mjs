import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, commit } from '../helpers/repo.mjs';
import { session, reach } from '../helpers/session.mjs';
import { readState } from '../../skills/tracer/scripts/lib/state.mjs';

test('small local work is verified without commits, GitHub or an Issue', () => {
  const { dir, tracer, gh, record } = session();
  assert.equal(tracer('start', 'Add a discount helper', '--scope', 'small').code, 0);
  record(1, '--kind', 'feature', '--gaps', '0');
  assert.equal(tracer('next').json.action.kind, 'implement-local');
  writeFileSync(join(dir, 'calc.cjs'), 'exports.total = (n, pct) => n * (1 - pct / 100);\n');
  const result = tracer('check', '--phase', '5', '--', 'node', '-e', "require('node:assert/strict').equal(require('./calc.cjs').total(100, 20), 80)");
  assert.equal(result.code, 0, JSON.stringify(result.json));
  assert.equal(tracer('next', '--compact').json.done, true);
  assert.equal(gh.s.calls.length, 0);
  assert.equal(git(dir, 'rev-list', '--count', 'HEAD'), '1');
  const proof = readState(dir).state.evidence.implement;
  assert.equal(proof.level, 'executed');
  assert.equal(JSON.parse(readFileSync(proof.path)).exitCode, 0);
  writeFileSync(join(dir, 'calc.cjs'), 'exports.total = () => 0;\n');
  assert.equal(tracer('next').json.phase, 5, 'uncommitted edits invalidate verification');
});

test('answer route stops after its conclusion and never calls GitHub', () => {
  const { tracer, gh, record } = session();
  tracer('start', 'Explain total', '--target', 'answer');
  record(1, '--kind', 'feature'); record(2);
  assert.equal(tracer('next').json.done, true);
  assert.equal(gh.s.calls.length, 0);
  assert.equal(tracer('start', 'Next question', '--target', 'answer').code, 0);
});

test('a small bug still needs confirmation and reproduction, but no Issue', () => {
  const { dir, tracer, gh, record } = session();
  tracer('start', 'Fix calculation', '--scope', 'small'); record(1, '--kind', 'bug');
  assert.equal(tracer('next').json.phase, 2);
  for (const phase of ['2', '3']) assert.equal(tracer('check', '--phase', phase, '--expect-exit', '1', '--', 'node', '-e', 'process.exit(1)').code, 0);
  assert.equal(tracer('next').json.action.kind, 'implement-local');
  writeFileSync(join(dir, 'fix.cjs'), 'module.exports = 80;\n');
  const verified = tracer('check', '--', 'node', '-e', "require('node:assert/strict').equal(require('./fix.cjs'), 80)");
  assert.equal(verified.code, 0, JSON.stringify(verified.json));
  assert.equal(tracer('next').json.done, true, 'fixing the bug must not invalidate its pre-fix reproduction');
  assert.equal(gh.s.issues.length, 0);
});

test('PR route keeps review, exact-head CI and draft status', () => {
  const { tracer, gh, record } = reach(6);
  record(6); record(7);
  assert.equal(tracer('next').json.action.kind, 'watch-ci');
  gh.s.checks = [{ __typename: 'CheckRun', name: 'tests', status: 'COMPLETED', conclusion: 'SUCCESS' }];
  assert.equal(tracer('ci').json.pass, true);
  assert.equal(tracer('next').json.done, true);
  assert.equal(gh.s.pr.isDraft, true);
  assert.equal(gh.s.issues.length, 0);
  assert.equal(tracer('allow', 'merge').code, 1);
});

test('CI pending, failing and wrong-head states never pass', () => {
  const { dir, tracer, gh, record, check } = reach(8);
  gh.s.checks = [{ __typename: 'CheckRun', status: 'IN_PROGRESS' }];
  assert.equal(tracer('ci').json.pending, true);
  gh.s.checks = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }];
  assert.equal(tracer('ci').json.pass, false);
  assert.equal(tracer('next').json.phase, 5);
  check(); record(6); record(7);
  gh.s.pr.sha = 'wrong-head';
  assert.match(tracer('ci').json.error, /does not point/);
  gh.s.pr.sha = git(dir, 'rev-parse', 'HEAD');
});

test('absent CI is disclosed, never described as checks green', () => {
  const { tracer } = reach(8);
  const r = tracer('ci');
  assert.equal(r.code, 0);
  assert.equal(r.json.checks, 0);
  assert.match(r.json.note, /CI unverified/);
});

test('missing, empty and blocking review reports are refused', () => {
  const { tracer, artifact } = reach(6);
  const args = ['record', '--phase', '6', '--result', 'pass', '--note', 'reviewer; independent: no'];
  assert.match(tracer(...args, '--evidence', '/tracer-no-such-report').json.error, /ENOENT/);
  assert.match(tracer(...args, '--evidence', artifact('empty', '')).json.error, /empty/);
  const file = artifact('blocking.json', { verdict: 'approve', summary: 'Unsafe', findings: [{ severity: 'high' }] });
  assert.match(tracer(...args, '--evidence', file).json.error, /blocking review/);
});

test('manual notes cannot impersonate executed tests or CI, or skip phases', () => {
  const { tracer } = session(); tracer('start', 'x');
  assert.match(tracer('record', '--phase', '5', '--result', 'pass').json.error, /Use tracer check/);
  assert.match(tracer('record', '--phase', '8', '--result', 'pass', '--note', 'checks green').json.error, /Use tracer ci/);
  assert.match(tracer('check', '--phase', '5', '--', 'node', '--version').json.error, /not current/);
});

test('runner errors are not expected reproduction failures', () => {
  const { tracer, record } = session();
  tracer('start', 'Fix x', '--scope', 'small'); record(1, '--kind', 'bug');
  const r = tracer('check', '--phase', '2', '--expect-exit', '1', '--', 'tracer-no-such-executable');
  assert.equal(r.code, 1); assert.equal(r.json.pass, false);
});

test('deleted state heals from the PR with an explicit PR destination', () => {
  const { dir, tracer } = reach(6); tracer('next');
  rmSync(join(dir, '.tracer/state.json'));
  const out = tracer('next', '--target', 'pr').json;
  assert.equal(out.name, 'review'); assert.match(out.warnings.join(' '), /restored/);
});

test('commits invalidate verification and need a push before review', () => {
  const { dir, tracer, check } = reach(6);
  commit(dir, 'src/calc.js', 'export const total = () => 2;\n', 'follow-up');
  assert.equal(tracer('next').json.phase, 5); check();
  assert.equal(tracer('next').json.action.kind, 'push-changes');
});

test('opt-in issues are deduplicated, including offline retries', () => {
  const { tracer, gh } = session(); tracer('start', 'Investigate follow-up');
  gh.s.offline = true;
  assert.equal(tracer('issue', 'create', '--title', 'Follow-up', '--body', 'Evidence and next step').json.queued, true);
  gh.s.offline = false; tracer('next');
  tracer('issue', 'create', '--title', 'Follow-up', '--body', 'Evidence and next step');
  assert.equal(gh.s.issues.length, 1);
});

test('protected changes promote small routes and require an answer', () => {
  const { dir, tracer, record } = session();
  tracer('start', 'Small helper', '--scope', 'small'); record(1, '--kind', 'feature');
  commit(dir, 'src/auth/login.js', 'export const login = () => true;\n', 'auth');
  assert.equal(tracer('next').json.phase, 2); record(2);
  record(4, '--touches', 'src/auth/login.js');
  assert.equal(tracer('next').json.stop.code, 'STOP_PROTECTED');
  assert.match(tracer('answer', 'No, stop').json.error, /letter/);
  assert.equal(tracer('next').json.stop.code, 'STOP_PROTECTED');
  tracer('answer', 'A. User approved'); assert.equal(tracer('next').json.stop, null);
});

test('Open items prevent PR completion until resolved', () => {
  const { tracer, gh } = reach(8); tracer('ci');
  gh.s.pr.body = '## Open items\n- [ ] inspect edge case';
  assert.equal(tracer('next').json.action.kind, 'close-open-items');
  gh.s.pr.body = '## Open items\n- [x] inspect edge case';
  assert.equal(tracer('next').json.done, true);
});

test('compact output preserves instructions without presentation duplication', () => {
  const { tracer } = session(); tracer('start', 'Small task', '--scope', 'small');
  const full = tracer('next').json, compact = tracer('next', '--compact').json;
  assert.equal(compact.action.instructions, full.action.instructions);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(full).length);
});
