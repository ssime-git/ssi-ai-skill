#!/usr/bin/env node
// Workflow replay, not a model benchmark. Counts actual engine output and calls.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { main } from '../skills/ssi/scripts/lib/cli.mjs';
import { makeGhStub } from '../tests/helpers/gh.mjs';

function replay(engine, { target, scope }, legacy = false, skillRoot = fileURLToPath(new URL('../skills/ssi', import.meta.url))) {
  const dir = mkdtempSync(join(tmpdir(), 'ssi-benchmark-'));
  const gh = makeGhStub();
  let calls = 0, outputBytes = 0, actions = 0;
  const references = new Set(['SKILL.md', 'references/communication.md']);
  // This replay explicitly starts the engine, so account for its on-demand guide too.
  if (existsSync(join(skillRoot, 'references/workflow.md'))) references.add('references/workflow.md');
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const git = (...args) => run('git', args);
  const invoke = (...args) => {
    let output = '';
    const code = engine(args, { cwd: dir, gh, run, write: (s) => { output += s; } });
    calls++; outputBytes += Buffer.byteLength(output);
    const result = JSON.parse(output);
    if (code) throw new Error(JSON.stringify({ args, result }));
    return result;
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'SSI benchmark'); git('config', 'user.email', 'ssi@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    writeFileSync(join(dir, 'README.md'), '# Fixture\n');
    git('add', '.'); git('commit', '-qm', 'fixture');
    invoke('start', 'Add total(100, 20) returning 80', ...(!legacy ? ['--target', target, '--scope', scope] : []));
    const artifact = (phase) => {
      const file = join(dir, '.ssi', `phase-${phase}.json`);
      const data = phase === 6 ? { verdict: 'approve', summary: 'Deterministic fixture review, not a model review', findings: [] } : { requirement: 'total(100, 20) === 80' };
      writeFileSync(file, JSON.stringify(data)); return file;
    };
    const record = (phase, ...args) => invoke('record', '--phase', String(phase), '--result', 'pass', '--evidence', artifact(phase), ...args);
    for (let i = 0; i < 30; i++) {
      const step = invoke('next', ...(!legacy ? ['--compact'] : [])); actions++;
      if (step.stop) throw new Error(JSON.stringify(step.stop));
      for (const ref of step.action?.refs ?? []) references.add(ref);
      if (step.done) {
        const instructionBytes = [...references].reduce((sum, ref) => sum + readFileSync(join(skillRoot, ref)).length, 0);
        return { actions, calls, outputBytes, instructionBytes, contextBytes: outputBytes + instructionBytes, githubCalls: gh.s.calls.length };
      }
      switch (step.action.kind) {
        case 'analyze': record(1, '--kind', 'feature', '--gaps', '0'); break;
        case 'confirm': record(2); break;
        case 'plan': record(4, '--touches', 'total.cjs'); break;
        case 'create-branch': git('switch', '-qc', 'ssi/fixture'); break;
        case 'implement':
        case 'implement-local': {
          writeFileSync(join(dir, 'total.cjs'), 'module.exports = (n, pct) => n * (1 - pct / 100);\n');
          if (legacy || target === 'pr') { git('add', 'total.cjs'); git('commit', '-qm', 'discount'); }
          if (!legacy && target !== 'pr') invoke('check', '--', 'node', '-e', "require('node:assert/strict').equal(require('./total.cjs')(100, 20), 80)");
          break;
        }
        case 'open-draft-pr': gh.openPr(1, 'ssi/fixture', true, git('rev-parse', 'HEAD')); break;
        case 'verify-implementation':
          if (legacy) { run('node', ['-e', "require('node:assert/strict').equal(require('./total.cjs')(100, 20), 80)"]); record(5); }
          else invoke('check', '--', 'node', '-e', "require('node:assert/strict').equal(require('./total.cjs')(100, 20), 80)");
          break;
        case 'review': record(6, '--note', 'fixture; independent: no'); break;
        case 'watch-ci':
          if (legacy) record(8, '--note', 'no CI configured'); else invoke('ci');
          break;
        default: throw new Error(`Unexpected action: ${step.action.kind}`);
      }
    }
    throw new Error('Replay did not terminate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const baselinePath = process.argv[2];
const baseline = baselinePath ? (await import(pathToFileURL(resolve(baselinePath, 'skills/ssi/scripts/lib/cli.mjs')))).main : null;
const results = [];
for (const route of [{ target: 'local', scope: 'small' }, { target: 'local', scope: 'standard' }, { target: 'pr', scope: 'standard' }]) {
  const current = replay(main, route);
  const before = baseline ? replay(baseline, route, true, resolve(baselinePath, 'skills/ssi')) : null;
  results.push({ ...route, current, ...(before ? { baseline: before,
    outputReductionPercent: Math.round(100 * (1 - current.outputBytes / before.outputBytes)),
    contextReductionPercent: Math.round(100 * (1 - current.contextBytes / before.contextBytes)),
  } : {}) });
}
console.log(JSON.stringify({ metric: 'UTF-8 engine output bytes; not model tokens', github: 'stubbed; no remote objects created', results }, null, 2));
