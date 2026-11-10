import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, opAllowed, DEFAULTS } from '../../skills/tracer/scripts/lib/config.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'tracer-cfg-'));
const put = (dir, file, content) => {
  const p = join(dir, file);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
};

test('defaults apply when no config exists', () => {
  assert.deepEqual(loadConfig({ cwd: tmp() }), DEFAULTS);
});

test('precedence: defaults < repo < local < flags', () => {
  const d = tmp();
  put(d, 'tracer.config.json', { thresholds: { diff: { lines: 500 } }, ui: { style: 'adhd' } });
  put(d, '.tracer/config.local.json', { thresholds: { diff: { lines: 700 } } });
  const c = loadConfig({ cwd: d, flags: { ui: { style: 'plain' } } });
  assert.equal(c.thresholds.diff.lines, 700);
  assert.equal(c.thresholds.diff.files, 8);
  assert.equal(c.ui.style, 'plain');
});

test('unknown key is an error naming the file and the key', () => {
  const d = tmp();
  put(d, 'tracer.config.json', { thresholds: { typo: 1 } });
  assert.throws(() => loadConfig({ cwd: d }), /tracer\.config\.json: Unknown config key: thresholds\.typo/);
});

test('floor: merge, close-issue and deploy can never be allowed', () => {
  for (const op of ['merge', 'close-issue', 'deploy']) {
    const d = tmp();
    put(d, 'tracer.config.json', { mandate: { allow: ['push', op] } });
    assert.throws(() => loadConfig({ cwd: d }), new RegExp(`"${op}" can never be allowed`));
  }
});

test('enum and positive-integer checks', () => {
  const a = tmp();
  put(a, 'tracer.config.json', { ui: { style: 'loud' } });
  assert.throws(() => loadConfig({ cwd: a }), /ui\.style must be one of: guided, adhd, plain/);
  const b = tmp();
  put(b, 'tracer.config.json', { thresholds: { reviewRounds: 0 } });
  assert.throws(() => loadConfig({ cwd: b }), /thresholds\.reviewRounds must be a positive integer/);
});

test('invalid JSON names the file', () => {
  const d = tmp();
  put(d, 'tracer.config.json', '{ nope');
  assert.throws(() => loadConfig({ cwd: d }), /tracer\.config\.json: invalid JSON/);
});

test('opAllowed honours the mandate and the floor', () => {
  assert.equal(opAllowed('push', DEFAULTS), true);
  assert.equal(opAllowed('ready', DEFAULTS), false);
  assert.equal(opAllowed('ready', { mandate: { allow: [], ready: true } }), true);
  assert.equal(opAllowed('merge', { mandate: { allow: ['merge'], ready: true } }), false);
});

test('the assets branch can never be a source branch or an unsafe name', () => {
  for (const bad of ['main', 'master', 'trunk', 'develop', 'HEAD', '-x', 'a b', 'x;y']) {
    const d = tmp();
    put(d, 'tracer.config.json', { assets: { branch: bad } });
    assert.throws(() => loadConfig({ cwd: d }), /assets\.branch/, bad);
  }
  const ok = tmp();
  put(ok, 'tracer.config.json', { assets: { branch: 'tracer-evidence' } });
  assert.equal(loadConfig({ cwd: ok }).assets.branch, 'tracer-evidence');
});

test('the Codex model and effort are plain names, never shell text', () => {
  const ok = tmp();
  put(ok, 'tracer.config.json', { review: { codexModel: 'gpt-5.5-terra', codexEffort: 'medium' } });
  assert.equal(loadConfig({ cwd: ok }).review.codexModel, 'gpt-5.5-terra');
  const bad = tmp();
  put(bad, 'tracer.config.json', { review: { codexModel: 'x"; rm -rf ~; "' } });
  assert.throws(() => loadConfig({ cwd: bad }), /review\.codexModel may only contain/);
});
