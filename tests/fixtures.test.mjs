// Deterministic fixture/storage tests, not agent qualification scenarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access, lstat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createFixtures, git } from './fixtures/create.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const owner = join(root,'.ssi');
// A fresh checkout has no private state: protect test output before writing it.
try {
  const info = await lstat(owner);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe .ssi path');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await mkdir(owner);
}
try { await writeFile(join(owner,'.gitignore'),'*\n',{flag:'wx'}); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const run = join(owner,'evaluations',`fixture-check-${Date.now()}`);
const fixtures = await createFixtures(join(run,'fixtures'), owner);

await test('Sixteen isolated fixtures, no remote configured', () => {
  assert.equal(Object.keys(fixtures).length,16);
  for(const f of Object.values(fixtures)) if(f.git) assert.equal(git(f.dir,'remote'),'');
});
await test('Empty fixture remains without Git and context', async () => {
  await assert.rejects(access(join(fixtures.empty.dir,'.git')));
  await assert.rejects(access(join(fixtures.empty.dir,'AGENTS.md')));
});
await test('Minimal behavior suite is green before workflow changes', () => {
  const r=spawnSync(process.execPath,['--test','app.test.mjs'],{cwd:fixtures.minimal.dir,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr+r.stdout);
});
await test('Integrated fixture is clean but has commits since observed base', () => {
  const f=fixtures.integrated;
  assert.equal(git(f.dir,'status','--porcelain'),'');
  assert.notEqual(f.head,f.base);
  assert.match(git(f.dir,'diff','--name-only',f.base,'HEAD'),/ci-command\.txt/);
});
await test('Internal exclusion protects notes and itself', async () => {
  const f=fixtures.minimal;
  await writeFile(join(f.dir,'.ssi','private.md'),'Synthetic private planning\n');
  assert.equal(git(f.dir,'check-ignore','.ssi/private.md'),'.ssi/private.md');
  assert.equal(git(f.dir,'check-ignore','.ssi/.gitignore'),'.ssi/.gitignore');
  assert.equal(git(f.dir,'status','--porcelain'),'');
});
await test('Context variants exist without implicit source migration', async () => {
  await access(join(fixtures['legacy-agents'].dir,'AGENTS.md'));
  await assert.rejects(access(join(fixtures['legacy-agents'].dir,'CLAUDE.md')));
  await access(join(fixtures['legacy-claude'].dir,'CLAUDE.md'));
  await assert.rejects(access(join(fixtures['legacy-claude'].dir,'AGENTS.md')));
  const f=fixtures['legacy-conflict'];
  assert.notEqual(await readFile(join(f.dir,'AGENTS.md'),'utf8'),await readFile(join(f.dir,'CLAUDE.md'),'utf8'));
});
await test('Absent notes are protected before first write, preserving human index', async () => {
  const f=fixtures.staged;
  const before=git(f.dir,'diff','--cached');
  await assert.rejects(access(join(f.dir,'.ssi')));
  await mkdir(join(f.dir,'.ssi'));
  await writeFile(join(f.dir,'.ssi','.gitignore'),'*\n');
  await writeFile(join(f.dir,'.ssi','new-note.md'),'Synthetic private note\n');
  assert.equal(git(f.dir,'check-ignore','.ssi/new-note.md'),'.ssi/new-note.md');
  assert.equal(git(f.dir,'diff','--cached'),before);
});
await test('Previously protected notes remain ignored, preserving human edits', async () => {
  const f=fixtures['staged-protected'];
  const before=git(f.dir,'diff','--cached');
  await writeFile(join(f.dir,'.ssi','new-note.md'),'Synthetic private note\n');
  assert.equal(git(f.dir,'check-ignore','.ssi/new-note.md'),'.ssi/new-note.md');
  assert.equal(git(f.dir,'diff','--cached'),before);
  assert.match(await readFile(join(f.dir,'README.md'),'utf8'),/Human unstaged/);
  assert.match(await readFile(join(f.dir,'untracked-user.txt'),'utf8'),/Human untracked/);
});
await test('Already indexed notes remain detectable despite exclusion', () => {
  const f=fixtures['staged-indexed'];
  const before=git(f.dir,'show',':owner.txt');
  assert.match(git(f.dir,'diff','--cached','--name-only'),/\.ssi\/note\.md/);
  assert.match(git(f.dir,'ls-files','--','.ssi'),/note\.md/);
  assert.equal(git(f.dir,'show',':owner.txt'),before);
});
await test('Already committed notes remain tracked despite exclusion', () => {
  const f=fixtures['staged-tracked'];
  const before=git(f.dir,'diff','--cached');
  assert.match(git(f.dir,'show','HEAD:.ssi/note.md'),/already in fixture history/);
  assert.match(git(f.dir,'ls-files','--','.ssi'),/note\.md/);
  assert.equal(git(f.dir,'diff','--cached'),before);
});
await test('Bug reproduction is actually red, baseline suite is still green', () => {
  const f=fixtures.bug;
  const red=spawnSync(process.execPath,['repro.mjs'],{cwd:f.dir,encoding:'utf8'});
  assert.notEqual(red.status,0);
  assert.match(red.stderr,/AssertionError/);
  assert.deepEqual(JSON.parse(red.stdout.trim()),{screen:0,invoice:0},'Both failing caller results must be evaluated before assertion');
  const green=spawnSync(process.execPath,['--test','app.test.mjs'],{cwd:f.dir,encoding:'utf8'});
  assert.equal(green.status,0);
});
await test('Generator refuses overwrite and paths outside protected evaluations', async () => {
  await assert.rejects(createFixtures(join(run,'fixtures'),owner),/overwrite/);
  await assert.rejects(createFixtures(join(root,'do-not-create'),owner),/inside protected/);
});
await writeFile(join(run,'fixture-report.json'),JSON.stringify({kind:'fixture-check-only',fixtures:16,agentTrials:0,liveGitHubTests:0,generatedFixtures:join(run,'fixtures'),note:'Node test runner output determines test success. No model behavior was tested.'},null,2)+'\n');
console.log(`Fixture evidence: ${run}`);
