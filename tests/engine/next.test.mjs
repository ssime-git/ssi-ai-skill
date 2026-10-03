import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRepo, commit, git } from '../helpers/repo.mjs';
import { makeGhStub } from '../helpers/gh.mjs';
import { makeRunner } from '../../scripts/lib/git.mjs';
import { DEFAULTS, merge } from '../../scripts/lib/config.mjs';
import { newState, readState, writeState } from '../../scripts/lib/state.mjs';
import { applyRecord } from '../../scripts/lib/record.mjs';
import { bar, say } from '../../scripts/lib/say.mjs';
import { actionFor } from '../../scripts/lib/actions.mjs';
import { computeNext } from '../../scripts/lib/next.mjs';

const next = (dir, gh, config = DEFAULTS) => computeNext({ cwd: dir, config, run: makeRunner(dir), gh });

test('applyRecord: pass stores evidence, binds later phases to the sha and surface', () => {
  const s = newState('g');
  applyRecord(s, { phase: 5, result: 'pass', evidence: 'out.txt', surface: ['src'] }, 'abc');
  assert.deepEqual(s.evidence.implement.surface, ['src']);
  assert.equal(s.evidence.implement.sha, 'abc');
  applyRecord(s, { phase: 3, result: 'pass', evidence: 'r.test.js' }, 'abc');
  assert.equal(s.evidence.reproduce.sha, undefined);
});

test('applyRecord: analyze with gaps blocks, kind is stored', () => {
  const s = newState('g');
  applyRecord(s, { phase: 1, result: 'pass', gaps: 2, kind: 'bug' }, 'abc');
  assert.equal(s.analysis.blockingGaps, 2);
  assert.equal(s.kind, 'bug');
  assert.equal(s.evidence.analyze, undefined);
  applyRecord(s, { phase: 1, result: 'pass', gaps: 0, evidence: 'b.md' }, 'abc');
  assert.ok(s.evidence.analyze);
});

test('applyRecord: failing review or CI sends the run back to implement', () => {
  const s = newState('g');
  for (const n of [5, 6, 7, 8]) applyRecord(s, { phase: n, result: 'pass' }, 'abc');
  applyRecord(s, { phase: 6, result: 'fail' }, 'abc');
  assert.deepEqual(Object.keys(s.evidence), []);
  assert.equal(s.attempts.review, 1);
});

test('applyRecord: failing confirm goes back to analyze; bad input is a clear error', () => {
  const s = newState('g');
  applyRecord(s, { phase: 1, result: 'pass', gaps: 0 }, 'a');
  applyRecord(s, { phase: 2, result: 'fail' }, 'a');
  assert.equal(s.evidence.analyze, undefined);
  assert.throws(() => applyRecord(s, { phase: 9, result: 'pass' }, 'a'), /Unknown phase/);
  assert.throws(() => applyRecord(s, { phase: 1, result: 'maybe' }, 'a'), /pass or fail/);
});

test('say: progress bar, styles and ETA', () => {
  assert.equal(bar(3), '▓▓▓░░░░░');
  const g = say({ phase: 3, name: 'reproduce', next: 'n', style: 'guided', needsUser: false, done: false });
  assert.equal(g.where, '▓▓▓░░░░░ 3/8 Reproduce');
  assert.equal(g.eta, undefined);
  assert.equal(say({ phase: 3, name: 'reproduce', next: 'n', style: 'adhd', needsUser: false, done: false }).eta, '~8 min');
  assert.equal(say({ phase: 3, name: 'reproduce', next: 'n', style: 'plain', needsUser: false, done: false }), null);
  assert.equal(say({ phase: 9, name: 'done', next: 'n', style: 'guided', needsUser: false, done: true }).where, '▓▓▓▓▓▓▓▓ 8/8 Done');
});

test('actionFor: phase 5 changes with the repo, mark-ready needs the config', () => {
  const st = { ...newState('g'), pr: null };
  const f = (o) => ({ commitsAhead: 0, pr: null, base: 'main', ...o });
  assert.equal(actionFor({ name: 'implement', state: st, facts: f({}), config: DEFAULTS }).kind, 'implement');
  const open = actionFor({ name: 'implement', state: st, facts: f({ commitsAhead: 1 }), config: DEFAULTS });
  assert.deepEqual([open.kind, open.requires], ['open-draft-pr', ['push', 'draft-pr']]);
  assert.equal(actionFor({ name: 'implement', state: st, facts: f({ commitsAhead: 1, pr: { number: 1 } }), config: DEFAULTS }).kind, 'verify-implementation');
  const ready = merge(DEFAULTS, { mandate: { ready: true } });
  assert.equal(actionFor({ name: 'done', state: st, facts: f({ pr: { number: 1, isDraft: true } }), config: ready }).kind, 'mark-ready');
  assert.equal(actionFor({ name: 'done', state: st, facts: f({ pr: { number: 1, isDraft: true } }), config: DEFAULTS }).kind, 'done');
});

test('computeNext: no run yet asks to start', () => {
  const out = next(makeRepo(), makeGhStub());
  assert.equal(out.action.kind, 'start');
  assert.equal(out.phase, 0);
});

test('computeNext: a started run begins at analyze and persists', () => {
  const dir = makeRepo();
  writeState(dir, newState('fix it'));
  const out = next(dir, makeGhStub());
  assert.deepEqual([out.name, out.action.kind, out.say.where], ['analyze', 'analyze', '▓░░░░░░░ 1/8 Analyze']);
  assert.equal(readState(dir).state.phase, 1);
});

test('computeNext: the PR state comment is written once and not rewritten without change', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  writeState(dir, { ...newState('fix it'), kind: 'feature' });
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  commit(dir, 'src/a.js', '1\n', 'a');
  gh.openPr(1, 'ssi/x');
  next(dir, gh);
  assert.equal(gh.s.comments.length, 1);
  const calls = gh.s.calls.length;
  next(dir, gh);
  const writes = gh.s.calls.slice(calls).filter((c) => c.includes('-f'));
  assert.equal(writes.length, 0);
});

test('computeNext: gh failing warns and keeps working', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  gh.s.offline = true;
  writeState(dir, newState('fix it'));
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  const out = next(dir, gh);
  assert.match(out.warnings.join(' '), /not reachable/);
  assert.ok(out.action);
});

test('computeNext: a step the mandate forbids becomes a stop', () => {
  const dir = makeRepo();
  writeState(dir, { ...newState('fix it'), kind: 'feature', evidence: { analyze: { path: 'a' }, confirm: { path: 'c' }, plan: { path: 'p' } } });
  git(dir, 'checkout', '-q', '-b', 'ssi/x');
  commit(dir, 'src/a.js', '1\n', 'a');
  const config = merge(DEFAULTS, { mandate: { allow: ['issue', 'comment'] } });
  const out = next(dir, makeGhStub(), config);
  assert.equal(out.stop.code, 'STOP_OUT_OF_MANDATE');
  assert.equal(out.action, null);
  assert.equal(out.say.needs_user, true);
});

test('computeNext: queued issue is created when the network is back', () => {
  const dir = makeRepo();
  const gh = makeGhStub();
  writeState(dir, { ...newState('fix it'), pending: [{ op: 'issue', title: 'T', body: 'B' }] });
  next(dir, gh);
  assert.equal(readState(dir).state.issue, 1);
  assert.equal(readState(dir).state.pending.length, 0);
});
