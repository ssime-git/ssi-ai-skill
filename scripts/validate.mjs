#!/usr/bin/env node
// Local structural checks only. This does not qualify model behavior.
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skill = join(root, 'skills/ssi');
const failures = [];
const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
}
async function read(relative) {
  try { return await readFile(join(root, relative), 'utf8'); }
  catch (error) { failures.push(`${relative}: ${error.code}`); return ''; }
}
async function markdown(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await markdown(p));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(p);
    else if (entry.isSymbolicLink()) failures.push(`Symlink not accepted in package: ${p}`);
  }
  return files;
}

const entry = await read('skills/ssi/SKILL.md');
const header = entry.match(/^---\n([\s\S]*?)\n---\n/);
check('Frontmatter delimited', header);
const lines = header?.[1].split('\n') ?? [];
check('Supported metadata only, quoted strings', lines.length === 2 && lines.every(l => /^(name|description): "(?:[^"\\]|\\.)*"$/.test(l)));
check('Skill name is ssi', lines.includes('name: "ssi"'));
check('Entry remains bounded (under 2200 whitespace words)', entry.split(/\s+/).length < 2200);
for (const name of ['context', 'github', 'plan', 'build', 'verify']) {
  const text = await read(`skills/ssi/references/${name}.md`);
  check(`Module ${name} exists and nonempty`, text.length > 200);
  check(`Entry links ${name}`, entry.includes(`references/${name}.md`));
}
for (const p of await markdown(skill)) {
  const text = await readFile(p, 'utf8');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^https?:\/\//.test(target)) continue;
    const full = resolve(dirname(p), target);
    check(`Local link stays inside package: ${target}`, full.startsWith(skill + '/') || full === skill);
    try { check(`Local link exists: ${target}`, (await stat(full)).isFile()); }
    catch { check(`Local link exists: ${target}`, false); }
  }
}
const notice = await read('skills/ssi/NOTICE.md');
check('Three upstream MIT notices included', (notice.match(/^MIT License$/gm) ?? []).length === 3);
for (const sha of ['c55ee46073ed923f86ce59a5eb3b6d895095d1b7','43b69e44c9ca905fe3a3418ccdf4102255e20d40','e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156']) check(`Pinned source ${sha}`, notice.includes(sha));
const scenarios = await read('tests/scenarios.md');
for (let n = 1; n <= 35; n++) check(`Scenario AC-${String(n).padStart(2, '0')} specified`, new RegExp(`^\\| ${String(n).padStart(2, '0')} \\|`, 'm').test(scenarios));
check('Scenario plan contains repeated-trial threshold', /3\/3/.test(scenarios));
// A clean checkout intentionally contains no private .ssi/ notes.
try {
  check('Local exclusion is exact when present', await readFile(join(root,'.ssi/.gitignore'),'utf8') === '*\n');
} catch (error) {
  check('No private state required in clean checkout', error.code === 'ENOENT');
}
console.log(JSON.stringify({ kind: 'structural-only', checks: checks.length, passed: checks.filter(c => c.passed).length, failures, qualification: 'NOT_EVALUATED: no agent behavior or live GitHub integration tested' }, null, 2));
process.exitCode = failures.length ? 1 : 0;
