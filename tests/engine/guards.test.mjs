import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateGuards, detectContext } from '../../skills/ssi/scripts/lib/guards.mjs';

const proj = (files, guards) => {
  const d = mkdtempSync(join(tmpdir(), 'ssi-guards-'));
  for (const [f, c] of Object.entries(files)) {
    mkdirSync(join(d, f, '..'), { recursive: true });
    writeFileSync(join(d, f), c);
  }
  if (guards) writeFileSync(join(d, 'ssi.guards.json'), JSON.stringify(guards));
  return d;
};
const status = (d, exec) => Object.fromEntries(evaluateGuards(d, { exec }).results.map((r) => [r.id, r.status]));
const ok = () => ({ status: 0 });

test('detectContext: reads the stack from files, never guesses', () => {
  const d = proj({ 'db/migrations/001.sql': '', 'infra/main.tf': '', 'requirements.txt': 'mlflow==2' });
  const c = detectContext(d);
  assert.deepEqual([c.migrations, c.terraform, c['model-registry'], c['llm-evals']], [true, true, true, false]);
});

test('an applicable contract with no guard is uncovered and blocks', () => {
  const d = proj({ 'migrations/1.sql': '' });
  assert.equal(status(d, ok)['db-migration'], 'uncovered');
  assert.equal(evaluateGuards(d, { exec: ok }).ok, false);
});

test('a contract that does not apply is n/a and the run is ok', () => {
  const d = proj({ 'a.txt': '' });
  assert.equal(evaluateGuards(d, { exec: ok }).ok, true);
});

test('proof by failure: pass needs run=0 and mustFail!=0', () => {
  const g = { guards: [{ id: 'db-migration', run: 'good', mustFail: 'bad' }] };
  const d = proj({ 'migrations/1.sql': '' }, g);
  assert.equal(status(d, (c) => ({ status: c === 'good' ? 0 : 1 }))['db-migration'], 'pass');
  assert.equal(status(d, ok)['db-migration'], 'unproven');
  assert.equal(status(d, () => ({ status: 1 }))['db-migration'], 'fail');
});

test('params must be filled; waiver needs author and reason; unknown ids are refused', () => {
  const p = proj({ 'migrations/1.sql': '' }, { guards: [{ id: 'db-migration', run: 'a', mustFail: 'b', params: { backup: '' } }] });
  assert.equal(status(p, ok)['db-migration'], 'invalid');
  const w1 = proj({ 'migrations/1.sql': '' }, { waivers: [{ id: 'db-migration', by: 'seb', reason: 'toy db' }] });
  assert.equal(status(w1, ok)['db-migration'], 'waived');
  const w2 = proj({ 'migrations/1.sql': '' }, { waivers: [{ id: 'db-migration' }] });
  assert.equal(status(w2, ok)['db-migration'], 'invalid');
  const u = proj({ 'a.txt': '' }, { guards: [{ id: 'nope', run: 'a', mustFail: 'b' }] });
  assert.equal(evaluateGuards(u, { exec: ok }).ok, false);
});
