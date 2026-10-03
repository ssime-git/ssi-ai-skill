import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../scripts/lib/state.mjs';
import { DEFAULTS } from '../../scripts/lib/config.mjs';
import { detectPhase } from '../../scripts/lib/detect.mjs';

const facts = (o = {}) => ({ branch: 'main', onBase: true, headSha: 'H2', commitsAhead: 0, pr: null, uiChanged: false, changedSince: () => [], ...o });
const ev = (sha, extra = {}) => ({ path: 'p', at: 't', sha, ...extra });
const st = (o = {}) => ({ ...newState('g'), kind: 'feature', ...o });
const run = (state, f = facts(), config = DEFAULTS) => detectPhase({ state, facts: f, config });

test('an empty run starts at analyze', () => {
  const r = run(st());
  assert.deepEqual([r.phase, r.name], [1, 'analyze']);
});

test('a feature skips reproduce', () => {
  const r = run(st({ evidence: { analyze: ev(), confirm: ev() } }));
  assert.deepEqual([r.phase, r.name], [4, 'plan']);
  assert.ok(r.skipped.includes('reproduce'));
});

test('a bug needs a repro, then an issue', () => {
  const base = { kind: 'bug', evidence: { analyze: ev(), confirm: ev() } };
  assert.equal(run(st(base)).phase, 3);
  const withRepro = { ...base, evidence: { ...base.evidence, reproduce: ev() } };
  assert.equal(run(st(withRepro)).phase, 3);
  assert.equal(run(st({ ...withRepro, issue: 4 })).phase, 4);
});

test('the issue is not required when the mandate does not allow issues', () => {
  const config = { ...DEFAULTS, mandate: { allow: ['push', 'draft-pr', 'comment'], ready: false } };
  const state = st({ kind: 'bug', evidence: { analyze: ev(), confirm: ev(), reproduce: ev() } });
  assert.equal(run(state, facts(), config).phase, 4);
});

const full = { analyze: ev(), confirm: ev(), plan: ev(), implement: ev('H2'), review: ev('H2'), land: ev('H2') };

test('all evidence valid means done (phase 9) with visual skipped when there is no UI', () => {
  const r = run(st({ evidence: full }), facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1 }));
  assert.deepEqual([r.phase, r.name], [9, 'done']);
});

test('a UI change makes visual proof required', () => {
  const r = run(st({ evidence: full }), facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1, uiChanged: true }));
  assert.deepEqual([r.phase, r.name], [7, 'visual']);
});

test('visual can be forced off or on by config', () => {
  const off = { ...DEFAULTS, visual: { enabled: 'off', tool: 'playwright' } };
  const on = { ...DEFAULTS, visual: { enabled: 'on', tool: 'playwright' } };
  const f = facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1, uiChanged: true });
  assert.equal(run(st({ evidence: full }), f, off).phase, 9);
  assert.equal(run(st({ evidence: full }), facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1 }), on).phase, 7);
});

test('evidence is stale when files in its surface changed since its sha', () => {
  const state = st({ evidence: { ...full, implement: ev('H1', { surface: ['src'] }) } });
  const f = facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1, changedSince: () => ['src/a.js'] });
  const r = run(state, f);
  assert.deepEqual([r.phase, r.stale], [5, ['implement']]);
});

test('evidence stays valid when the change is outside its surface', () => {
  const state = st({ evidence: { ...full, implement: ev('H1', { surface: ['src'] }), review: ev('H1', { surface: ['src'] }), land: ev('H1', { surface: ['src'] }) } });
  const f = facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1, changedSince: () => ['docs/readme.md'] });
  assert.equal(run(state, f).phase, 9);
});

test('an unknown sha makes evidence stale', () => {
  const state = st({ evidence: { ...full, implement: ev('GONE') } });
  const f = facts({ branch: 'ssi/x', onBase: false, commitsAhead: 1, changedSince: () => null });
  assert.equal(run(state, f).phase, 5);
});

test('floors: commits or a PR mean at least phase 5, an ssi branch at least phase 4', () => {
  const a = run(st(), facts({ branch: 'ssi/x', onBase: false, commitsAhead: 2 }));
  assert.equal(a.phase, 5);
  assert.match(a.warnings[0], /resumed at phase 5/);
  assert.equal(run(st(), facts({ branch: 'ssi/x', onBase: false })).phase, 4);
  assert.equal(run(st(), facts({ branch: 'feature-y', onBase: false })).phase, 1);
  assert.equal(run(st(), facts({ pr: { number: 3, state: 'OPEN', isDraft: true } })).phase, 5);
});
