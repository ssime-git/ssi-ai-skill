import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCheck } from '../../skills/ssi/scripts/lib/evidence.mjs';
import { evaluateGuards } from '../../skills/ssi/scripts/lib/guards.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { session } from '../helpers/session.mjs';

test('signals, missing commands and timeouts cannot prove an expected failure', () => {
  for (const error of [
    { status: 127 }, { status: 126 }, { status: null, signal: 'SIGTERM' },
    { status: null, code: 'ETIMEDOUT' }, { status: 0, code: 'EPERM' },
  ]) {
    const result = executeCheck(() => { throw error; }, 'check', [], 1);
    assert.equal(result.pass, false);
  }
  assert.equal(executeCheck(() => { throw { status: 1, stdout: 'expected assertion failure' }; }, 'check', [], 1).pass, true);
});

test('negative guards reject execution failures and unrelated edits skip guards', () => {
  const { dir } = session();
  writeFileSync(join(dir, 'ssi.guards.json'), JSON.stringify({ guards: [{ id: 'db-migration', run: 'good', mustFail: 'bad' }] }));
  for (const bad of [{ status: 127 }, { status: null, error: 'timeout' }, { status: null, signal: 'SIGTERM' }]) {
    const result = evaluateGuards(dir, { changedFiles: ['db/migrations/001.sql'], exec: (cmd) => cmd === 'good' ? { status: 0 } : bad });
    assert.equal(result.ok, false);
    assert.equal(result.results[0].status, 'invalid');
  }
  const docsOnly = evaluateGuards(dir, { changedFiles: ['README.md'], exec: () => { throw Error('Must not run unrelated guards'); } });
  assert.equal(docsOnly.ok, true);
});

test('model source changes retain dependency-based gates without a manifest edit', () => {
  const { dir } = session();
  writeFileSync(join(dir, 'pyproject.toml'), '[project]\ndependencies = ["mlflow"]\n');
  writeFileSync(join(dir, 'ssi.guards.json'), JSON.stringify({ guards: [{ id: 'model-promotion', run: 'gate', mustFail: 'bad-case' }] }));
  const result = evaluateGuards(dir, { changedFiles: ['src/train.py'], exec: () => ({ status: 1 }) });
  assert.equal(result.ok, false);
  assert.equal(result.results.find((r) => r.id === 'model-promotion').status, 'fail');
  assert.equal(evaluateGuards(dir, { changedFiles: ['README.md'] }).ok, true);
});

test('additional checks retain earlier receipts for the same snapshot', () => {
  const { dir, ssi, record } = session();
  ssi('start', 'Small edit', '--scope', 'small'); record(1, '--kind', 'feature');
  writeFileSync(join(dir, 'a.js'), 'module.exports = 1;\n');
  for (const expr of ["require('node:assert/strict').equal(require('./a.js'), 1)", "require('node:assert/strict').equal(typeof require('./a.js'), 'number')"]) {
    assert.equal(ssi('check', '--', 'node', '-e', expr).code, 0);
  }
  const state = JSON.parse(readFileSync(join(dir, '.ssi/state.json'), 'utf8'));
  assert.equal(state.evidence.implement.checks.length, 2);
});

test('follow-up Issues stay distinct and do not become the bug closing reference', () => {
  const { dir, ssi, gh } = session(); ssi('start', 'Track useful discoveries');
  for (const title of ['Remove duplication', 'Measure slow query', 'Remove duplication']) {
    assert.equal(ssi('issue', 'create', '--follow-up', '--title', title, '--body', 'Evidence; impact; next step').code, 0);
  }
  assert.equal(gh.s.issues.length, 2);
  const state = JSON.parse(readFileSync(join(dir, '.ssi/state.json'), 'utf8'));
  assert.equal(state.issue, null);
  assert.deepEqual(state.followups, [1, 2]);
});
