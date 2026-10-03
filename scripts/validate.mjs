#!/usr/bin/env node
// Structural checks only; behaviour is covered by tests/engine.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); };
const read = (p) => readFileSync(join(root, p), 'utf8');

const skill = read('skills/ssi/SKILL.md');
const front = /^---\nname: "?ssi"?\ndescription: .+\n---\n/.test(skill);
check('SKILL.md frontmatter is name + description', front);
check('SKILL.md stays under 90 lines', skill.split('\n').length < 90);

const refs = readdirSync(join(root, 'skills/ssi/references')).filter((f) => f.endsWith('.md'));
for (const f of refs) check(`SKILL.md links references/${f}`, skill.includes(`references/${f}`));
for (const m of skill.matchAll(/\]\(([^)#]+)\)/g)) {
  if (/^https?:/.test(m[1])) continue;
  check(`link exists: ${m[1]}`, existsSync(join(root, 'skills/ssi', m[1])));
}
const notice = read('skills/ssi/NOTICE.md');
check('SKILL.md does not reach outside its folder', !/\.\.\/\.\.\//.test(skill));
check('NOTICE has at least four MIT licences', (notice.match(/^MIT License$/gm) ?? []).length >= 4);
for (const f of ['skills/ssi/scripts/ssi.mjs', 'skills/ssi/scripts/lib/next.mjs', 'mods/ssi-cockpit/hooks/register.tsx']) check(`${f} exists`, existsSync(join(root, f)));

if (failures.length) {
  console.error(failures.map((f) => `FAIL ${f}`).join('\n'));
  process.exit(1);
}
console.log('ssi package: structure ok');
