import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../skills/ssi/scripts/lib/state.mjs';
import { DEFAULTS } from '../../skills/ssi/scripts/lib/config.mjs';
import { globToRegExp, evaluateStops, mandateStop, applyAnswer } from '../../skills/ssi/scripts/lib/stops.mjs';

const facts = (o = {}) => ({ branch: 'ssi/x', headSha: 'H', diff: { lines: 10, files: 1 }, pr: null, branchExists: () => true, isAncestor: () => true, ...o });
const base = (o = {}) => ({ ...newState('g'), kind: 'bug', branch: 'ssi/x', head_sha: 'H', ...o });
const stops = (state, f = facts(), phase = 5) => evaluateStops({ state, facts: f, config: DEFAULTS, phase });

test('globs match the protected defaults', () => {
  const m = (g, p) => globToRegExp(g).test(p);
  assert.ok(m('**/auth/**', 'src/auth/login.js'));
  assert.ok(m('**/auth/**', 'auth/x.js'));
  assert.ok(m('**/payment*/**', 'app/payments/charge.ts'));
  assert.ok(m('**/schema*', 'db/schema.sql'));
  assert.ok(!m('**/auth/**', 'src/author/x.js'));
  assert.ok(m('src/*.js', 'src/a.js'));
  assert.ok(!m('src/*.js', 'src/deep/a.js'));
});

test('no stop on a healthy run', () => {
  assert.equal(stops(base()), null);
});

test('an unanswered stop persists and wins', () => {
  const s = base({ stop: { code: 'STOP_CI', because: 'x', question: 'q', options: [], default: 'A' } });
  assert.equal(stops(s).code, 'STOP_CI');
});

test('reality: missing branch, other branch, rewritten history, closed PR', () => {
  assert.equal(stops(base(), facts({ branchExists: () => false })).code, 'STOP_REALITY');
  assert.match(stops(base(), facts({ branch: 'main' })).because, /you are on main/);
  assert.match(stops(base(), facts({ isAncestor: () => false })).because, /rewritten/);
  assert.match(stops(base({ pr: 5 }), facts({ pr: { state: 'MERGED' } })).because, /merged/);
});

test('unclear request, then no repro', () => {
  assert.equal(stops(base({ analysis: { blockingGaps: 2 } }), facts(), 1).code, 'STOP_UNCLEAR');
  assert.equal(stops(base({ attempts: { reproduce: 3 } }), facts(), 3).code, 'STOP_NO_REPRO');
  assert.equal(stops(base({ attempts: { reproduce: 2 } }), facts(), 3), null);
});

test('protected paths and public API stop once the plan exists, until approved', () => {
  const plan = { evidence: { plan: { path: 'p' } }, plan: { touches: ['src/auth/login.js'], publicApi: false } };
  assert.equal(stops(base(plan), facts(), 4).code, 'STOP_PROTECTED');
  assert.equal(stops(base({ ...plan, approvals: { protected: true, bigDiff: false } }), facts(), 4), null);
  assert.equal(stops(base({ evidence: { plan: { path: 'p' } }, plan: { touches: [], publicApi: true } }), facts(), 4).code, 'STOP_PROTECTED');
});

test('big diff stops from phase 5 on, only above the limits', () => {
  const big = facts({ diff: { lines: 301, files: 2 } });
  assert.equal(stops(base(), big, 5).code, 'STOP_BIG_DIFF');
  assert.equal(stops(base(), facts({ diff: { lines: 300, files: 8 } }), 5), null);
  assert.equal(stops(base(), facts({ diff: { lines: 1, files: 9 } }), 6).code, 'STOP_BIG_DIFF');
  assert.equal(stops(base(), big, 4), null);
});

test('review, visual and CI budgets stop after the configured tries', () => {
  assert.equal(stops(base({ attempts: { review: 2 } })).code, 'STOP_REVIEW');
  assert.equal(stops(base({ attempts: { review: 2 }, evidence: { review: { path: 'r' } } })), null);
  assert.equal(stops(base({ attempts: { visual: 2 } })).code, 'STOP_VISUAL');
  assert.equal(stops(base({ attempts: { land: 2 } })).code, 'STOP_CI');
});

test('mandateStop names the missing operation', () => {
  const s = mandateStop('push');
  assert.equal(s.code, 'STOP_OUT_OF_MANDATE');
  assert.match(s.because, /"push"/);
});

test('answering A resolves and applies the effect, B keeps the stop', () => {
  const s = base({ stop: { code: 'STOP_PROTECTED', because: 'x', question: 'q', options: [], default: 'B' } });
  applyAnswer(s, facts(), 'B. no');
  assert.equal(s.stop.code, 'STOP_PROTECTED');
  applyAnswer(s, facts(), 'A. yes');
  assert.equal(s.stop, null);
  assert.equal(s.approvals.protected, true);
});

test('answers reset budgets and re-anchor reality', () => {
  const r = base({ attempts: { review: 2 }, stop: { code: 'STOP_REVIEW' } });
  applyAnswer(r, facts(), 'A');
  assert.equal(r.attempts.review, 0);
  const u = base({ analysis: { blockingGaps: 2 }, stop: { code: 'STOP_UNCLEAR' } });
  applyAnswer(u, facts(), 'Use Postgres');
  assert.equal(u.analysis.blockingGaps, 0);
  assert.ok(u.evidence.analyze);
  const y = base({ branch: 'ssi/old', pr: 5, stop: { code: 'STOP_REALITY' } });
  applyAnswer(y, facts({ branch: 'ssi/new', headSha: 'N', pr: { state: 'CLOSED' } }), 'A');
  assert.deepEqual([y.branch, y.head_sha, y.pr], ['ssi/new', 'N', null]);
});

test('answering with no open question is an error', () => {
  assert.throws(() => applyAnswer(base(), facts(), 'A'), /no open question/);
});
