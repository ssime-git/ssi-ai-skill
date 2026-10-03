import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newState, readState, writeState, PHASES } from '../../scripts/lib/state.mjs';

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

test('run ids are unique and prefixed', () => {
  const a = newState('x'), b = newState('x');
  assert.match(a.run_id, /^ssi-[0-9a-f]{6}$/);
  assert.notEqual(a.run_id, b.run_id);
});
