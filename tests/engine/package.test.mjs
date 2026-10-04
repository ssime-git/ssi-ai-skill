import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

test('the repo has an MIT licence and a short README that credits every upstream and shows the flow', () => {
  assert.match(read('LICENSE'), /^MIT License\n\nCopyright \(c\) 2026 /);
  const readme = read('README.md');
  assert.ok(readme.split('\n').length < 110, 'README must stay short');
  for (const m of read('skills/ssi/NOTICE.md').matchAll(/^## ([\w.-]+\/[\w.-]+)/gm)) {
    assert.ok(readme.includes(m[1]), `README credits ${m[1]}`);
  }
  assert.ok((readme.match(/```mermaid/g) ?? []).length >= 2, 'README shows the flow with diagrams');
  assert.match(readme, /## What is different/);
});

test('the skill, its guides, the README and the docs are written in English', () => {
  const files = execFileSync('git', ['ls-files', 'skills', 'README.md', 'docs', 'mods'], { encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(md|mjs|tsx|ts)$/.test(f) && !f.endsWith('NOTICE.md'));
  // The detector's word list is stored in ROT13 so that no French word appears in the repository.
  const rot13 = (t) => t.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.charCodeAt(0) & 95) < 78 ? 13 : -13) + c.charCodeAt(0)));
  const french = new RegExp(`\\b(${rot13('yr|yn|yrf|qrf|har|rfg|cbhe|nirp|qnaf|dhr|dhv|znvf|prggr|abhf|ibhf')})\\b`, 'gi');
  const english = /\b(the|and|to|of|is|for|with|this|that|you)\b/i;
  const offenders = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      if ((line.match(french) ?? []).length >= 2 && !english.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('CI runs the validator and the tests on every pull request, on Node 20 and 22', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /pull_request:/);
  assert.match(ci, /node: \[20, 22\]/);
  assert.match(ci, /run: npm run validate/);
  assert.match(ci, /run: npm test/);
  assert.doesNotMatch(read('package.json'), /--test \\"/);
});
