import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newState, readState, writeState, statePath, PHASES } from '../../skills/ssi/scripts/lib/state.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'ssi-state-'));

test('phases are the eight named steps', () => {
  assert.deepEqual(PHASES, ['analyze', 'confirm', 'reproduce', 'plan', 'implement', 'review', 'visual', 'land']);
});

test('write then read roundtrips, ignores itself and leaves no temp file', () => {
  const cwd = tmp();
  writeState(cwd, newState('fix login'));
  assert.equal(readState(cwd).state.goal, 'fix login');
  assert.equal(readFileSync(join(cwd, '.ssi/.gitignore'), 'utf8'), '*\n');
  assert.deepEqual(readdirSync(join(cwd, '.ssi')).sort(), ['.gitignore', 'state.json']);
});

test('a missing file is null without a warning', () => {
  assert.deepEqual(readState(tmp()), { state: null });
});

test('a corrupt file is null with a plain-English warning', () => {
  const cwd = tmp();
  mkdirSync(join(cwd, '.ssi'));
  writeFileSync(join(cwd, '.ssi/state.json'), '{ broken');
  const r = readState(cwd);
  assert.equal(r.state, null);
  assert.match(r.warning, /unreadable/);
});

test('the progress timestamp ignores volatile fields and moves only on real progress', () => {
  const cwd = tmp();
  writeState(cwd, newState('g'));
  const t1 = readState(cwd).state.updated_at;
  const volatile = readState(cwd).state;
  volatile.phase = 7;
  volatile.head_sha = 'abc1234';
  volatile.synced = 'h';
  writeState(cwd, volatile);
  assert.equal(readState(cwd).state.updated_at, t1);
  const raw = readState(cwd).state;
  raw.updated_at = '2000-01-01T00:00:00.000Z';
  writeFileSync(statePath(cwd), JSON.stringify(raw));
  const progress = readState(cwd).state;
  progress.evidence.plan = { path: 'p' };
  writeState(cwd, progress);
  assert.notEqual(readState(cwd).state.updated_at, '2000-01-01T00:00:00.000Z');
});

test('state is refused when the folder does not ignore it, and a bad ignore file is repaired', () => {
  const cwd = tmp();
  mkdirSync(join(cwd, '.ssi'));
  writeFileSync(join(cwd, '.ssi/.gitignore'), '# nothing useful\n');
  writeState(cwd, newState('g'));
  assert.equal(readFileSync(join(cwd, '.ssi/.gitignore'), 'utf8').split('\n').includes('*'), true);
});

test('run ids are unique and prefixed', () => {
  const a = newState('x'), b = newState('x');
  assert.match(a.run_id, /^ssi-[0-9a-f]{6}$/);
  assert.notEqual(a.run_id, b.run_id);
});
