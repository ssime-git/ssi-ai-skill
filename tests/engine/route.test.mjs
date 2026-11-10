import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newState } from '../../skills/tracer/scripts/lib/state.mjs';
import { DEFAULTS, loadConfig } from '../../skills/tracer/scripts/lib/config.mjs';
import { riskOf, reviewRoles, modelFor, surfacesOf } from '../../skills/tracer/scripts/lib/route.mjs';
import { evaluateStops, applyAnswer, refusalStop } from '../../skills/tracer/scripts/lib/stops.mjs';
import { readEvidence } from '../../skills/tracer/scripts/lib/evidence.mjs';
import { addFeedback, fromReview, resolveFeedback, renderFeedback } from '../../skills/tracer/scripts/lib/feedback.mjs';
import { renderBlock, parseBlock } from '../../skills/tracer/scripts/lib/remote.mjs';

const facts = (files, o = {}) => ({ branch: 'tracer/x', headSha: 'H', changedFiles: files, modifiedExisting: [], diff: { lines: 10, files: files.length }, pr: null, branchExists: () => true, isAncestor: () => true, ...o });
const state = (o = {}) => ({ ...newState('g'), kind: 'feature', branch: 'tracer/x', head_sha: 'H', ...o });

test('surfaces and risk come from the real diff', () => {
  assert.deepEqual(surfacesOf(['src/Button.tsx']), { ui: true, ux: true, security: false, data: false });
  assert.equal(riskOf(state(), facts(['src/util.js']), DEFAULTS), 'low');
  assert.equal(riskOf(state(), facts(['src/Button.tsx']), DEFAULTS), 'medium');
  assert.equal(riskOf(state(), facts(['src/auth/login.js']), DEFAULTS), 'high');
});

test('review roles: UI and UX are added only when the diff touches a UI surface', () => {
  assert.deepEqual(reviewRoles(state(), facts(['src/util.js']), DEFAULTS), []);
  assert.deepEqual(reviewRoles(state(), facts(['src/Button.tsx']), DEFAULTS), ['ui', 'ux']);
  assert.deepEqual(reviewRoles(state(), facts(['db/migrations/001.sql', 'src/Page.vue']), DEFAULTS), ['ui', 'ux', 'data']);
  const off = { ...DEFAULTS, review: { ...DEFAULTS.review, roles: ['security'] } };
  assert.deepEqual(reviewRoles(state(), facts(['src/Button.tsx']), off), []);
});

test('a review report must cover the required roles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracer-'));
  const write = (r) => { writeFileSync(join(dir, 'r.json'), JSON.stringify({ verdict: 'approve', summary: 's', findings: [], ...r })); };
  write({});
  assert.throws(() => readEvidence(dir, 'r.json', { review: true, roles: ['ui', 'ux'] }), /ui, ux/);
  write({ roles: ['general', 'ui'] });
  assert.throws(() => readEvidence(dir, 'r.json', { review: true, roles: ['ui', 'ux'] }), /ux/);
  write({ roles: ['general', 'ui', 'ux'] });
  assert.ok(readEvidence(dir, 'r.json', { review: true, roles: ['ui', 'ux'] }).digest);
  write({});
  assert.ok(readEvidence(dir, 'r.json', { review: true }).digest);
});

test('model tier per step, raised by risk and by earlier failures', () => {
  const low = facts(['src/util.js']);
  assert.equal(modelFor('analyze', state(), low, DEFAULTS).tier, 'fast');
  assert.equal(modelFor('implement', state(), low, DEFAULTS).tier, 'balanced');
  assert.equal(modelFor('review', state(), low, DEFAULTS).tier, 'deep');
  assert.equal(modelFor('implement', state(), facts(['src/auth/x.js']), DEFAULTS).tier, 'deep');
  assert.equal(modelFor('implement', state({ attempts: { implement: 1 } }), low, DEFAULTS).tier, 'deep');
  assert.equal(modelFor('visual', state({ attempts: { visual: 1 } }), low, DEFAULTS).tier, 'balanced');
  const named = { ...DEFAULTS, models: { ...DEFAULTS.models, tiers: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' } } };
  assert.equal(modelFor('plan', state(), low, named).name, 'sonnet');
});

test('model config is validated', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracer-'));
  const load = (c) => { writeFileSync(join(dir, 'tracer.config.json'), JSON.stringify(c)); return loadConfig({ cwd: dir }); };
  assert.equal(load({ models: { steps: { plan: 'deep' } } }).models.steps.plan, 'deep');
  assert.throws(() => load({ models: { steps: { plan: 'huge' } } }), /fast, balanced, deep/);
  assert.throws(() => load({ models: { steps: { dance: 'fast' } } }), /Unknown config key/);
  assert.throws(() => load({ models: { tiers: { fast: 'a b; rm' } } }), /may only contain/);
  assert.throws(() => load({ review: { roles: ['ui', 'taste'] } }), /Unknown review role/);
});

test('editing an existing test is a stop that needs a per-file approval', () => {
  const s = state({ evidence: { plan: { at: 'x' } } });
  const f = facts(['tests/a.test.js', 'src/a.js'], { modifiedExisting: ['tests/a.test.js'] });
  const stop = evaluateStops({ state: s, facts: f, config: DEFAULTS, phase: 5 });
  assert.equal(stop.code, 'STOP_FROZEN');
  assert.deepEqual(stop.files, ['tests/a.test.js']);
  s.stop = stop;
  applyAnswer(s, f, 'A. yes, the assertion was wrong');
  assert.equal(evaluateStops({ state: s, facts: f, config: DEFAULTS, phase: 5 }), null);
  // A new test file is not an edit of an existing one.
  assert.equal(evaluateStops({ state: state(), facts: facts(['tests/new.test.js']), config: DEFAULTS, phase: 5 }), null);
});

test('a refusal stops the run; a changed request replaces the goal', () => {
  const s = state({ goal: 'merge it and deploy', stop: refusalStop('the engine never merges or deploys') });
  assert.equal(evaluateStops({ state: s, facts: facts([]), config: DEFAULTS, phase: 1 }).code, 'STOP_REFUSED');
  applyAnswer(s, facts([]), 'A. only prepare the draft PR');
  assert.equal(s.goal, 'only prepare the draft PR');
  assert.equal(s.stop, null);
});

test('feedback is traced, neutralised and shown in the PR comment', () => {
  const s = state();
  fromReview(s, { findings: [{ severity: 'medium', title: 'Button | <script>alert(1)</script>\nlabel missing', file: 'src/B.tsx', line_start: 4, role: 'ui' }] }, 'codex');
  assert.equal(s.feedback.length, 1);
  fromReview(s, { findings: [{ severity: 'medium', title: 'Button | <script>alert(1)</script>\nlabel missing', file: 'src/B.tsx', line_start: 4, role: 'ui' }] }, 'codex');
  assert.equal(s.feedback.length, 1, 'the same open finding is not duplicated');
  const table = renderFeedback(s);
  assert.match(table, /1 open of 1/);
  assert.doesNotMatch(table, /<script>/);
  assert.equal(table.split('\n').filter((l) => l.startsWith('| 1 ')).length, 1);
  assert.throws(() => resolveFeedback(s, 1, 'rejected', ''), /needs --note/);
  resolveFeedback(s, 1, 'fixed', 'added aria-label');
  assert.match(renderFeedback(s), /0 open of 1/);
  const block = renderBlock(s, '**Tracer progress**');
  assert.match(block, /\*\*Feedback\*\*/);
  assert.equal(parseBlock(block).feedback.length, 1, 'state still round-trips through the comment');
  assert.equal(addFeedback(s, { phase: 7, source: 'visual', title: 'ok', status: 'fixed' }), 2);
});
