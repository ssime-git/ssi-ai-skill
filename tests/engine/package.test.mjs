import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PHASES } from '../../skills/ssi/scripts/lib/state.mjs';

const read = (p) => readFileSync(p, 'utf8');

test('SKILL.md has valid frontmatter, a bounded size and links every reference', () => {
  const s = read('skills/ssi/SKILL.md');
  assert.match(s, /^---\nname: "?ssi"?\ndescription: .+\n---\n/);
  assert.ok(s.split('\n').length < 90, 'SKILL.md must stay thin');
  for (const n of [...PHASES, 'communication']) {
    assert.ok(s.includes(`references/${n}.md`), `SKILL.md links ${n}`);
    assert.ok(existsSync(`skills/ssi/references/${n}.md`), `${n}.md exists`);
  }
});

test('the skill never promises a merge, a deploy or a close', () => {
  const all = [read('skills/ssi/SKILL.md'), ...[...PHASES, 'communication'].map((n) => read(`skills/ssi/references/${n}.md`))].join('\n');
  assert.match(all, /never merge/i);
  assert.doesNotMatch(all, /gh pr merge/);
});

test('NOTICE keeps every upstream licence, including i-have-adhd', () => {
  const n = read('skills/ssi/NOTICE.md');
  assert.ok((n.match(/^MIT License$/gm) ?? []).length >= 4);
  assert.match(n, /ayghri\/i-have-adhd/);
});

test('the skill folder is self-contained and the repo is a plugin', () => {
  assert.ok(existsSync('skills/ssi/scripts/ssi.mjs'));
  assert.doesNotMatch(read('skills/ssi/SKILL.md'), /\.\.\/\.\.\//);
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).name, 'ssi');
});

test('the design spec and plan ship with the package', () => {
  assert.ok(existsSync('docs/superpowers/specs/2026-10-03-ssi-design.md'));
  assert.ok(existsSync('docs/superpowers/plans/2026-10-03-ssi-v2.md'));
});
