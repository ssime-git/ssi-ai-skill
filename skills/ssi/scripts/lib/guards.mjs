import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Fixed catalogue: which contracts exist and when they apply. The project supplies the
// check itself (ssi.guards.json); the engine only proves that it runs and that it can fail.
export const CATALOGUE = Object.freeze([
  { id: 'db-migration', principle: 'irreversible-needs-human', when: 'migrations', must: 'A destructive migration is blocked without a backup and a tested rollback.' },
  { id: 'infra-unexpected-diff', principle: 'unexpected-diff-blocks', when: 'terraform', must: 'An infra plan with an unplanned change fails the pipeline.' },
  { id: 'model-promotion', principle: 'irreversible-needs-human', when: 'model-registry', must: 'A candidate model that does not beat production on the agreed gates is not promoted.' },
  { id: 'llm-eval-gate', principle: 'measured-not-assumed', when: 'llm-evals', must: 'A prompt or model change that regresses the eval set fails the pipeline.' },
]);

const walk = (dir, depth = 3, out = []) => {
  if (depth < 0 || !existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    out.push({ name: e.name, dir: e.isDirectory() });
    if (e.isDirectory()) walk(p, depth - 1, out);
  }
  return out;
};

export function detectContext(cwd) {
  const all = walk(cwd);
  const text = ['requirements.txt', 'pyproject.toml', 'package.json']
    .map((f) => (existsSync(join(cwd, f)) ? readFileSync(join(cwd, f), 'utf8') : ''))
    .join('\n');
  return {
    migrations: all.some((f) => f.dir && /^migrations?$/.test(f.name)),
    terraform: all.some((f) => /\.tf$/.test(f.name)),
    'model-registry': /mlflow|wandb|sagemaker/i.test(text),
    'llm-evals': all.some((f) => f.dir && /^(evals?|prompts)$/.test(f.name)) || /promptfoo|deepeval|ragas|langsmith/i.test(text),
  };
}

const sh = (cmd, cwd) => spawnSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', timeout: 120000 });
const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

export function loadGuards(cwd) {
  const file = join(cwd, 'ssi.guards.json');
  if (!existsSync(file)) return { guards: [], waivers: [] };
  let j;
  try {
    j = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`ssi.guards.json: invalid JSON (${e.message})`);
  }
  return { guards: j.guards ?? [], waivers: j.waivers ?? [] };
}

// status: pass | fail | unproven | invalid | uncovered | waived | n/a
export function evaluateGuards(cwd, { exec = sh } = {}) {
  const ctx = detectContext(cwd);
  const { guards, waivers } = loadGuards(cwd);
  const results = [];
  for (const c of CATALOGUE) {
    const applies = !!ctx[c.when];
    const g = guards.find((x) => x.id === c.id);
    const w = waivers.find((x) => x.id === c.id);
    const r = { id: c.id, applies, status: 'n/a' };
    if (g) {
      if (!g.run || !g.mustFail) Object.assign(r, { status: 'invalid', why: 'needs "run" and "mustFail"' });
      else if (Object.values(g.params ?? {}).some((v) => !filled(v))) Object.assign(r, { status: 'invalid', why: 'a param is empty; fill it from the project, there is no default' });
      else if (exec(g.run, cwd).status !== 0) Object.assign(r, { status: 'fail', why: 'the check fails on the current tree' });
      else if (exec(g.mustFail, cwd).status === 0) Object.assign(r, { status: 'unproven', why: 'the bad case did not make the check fail' });
      else r.status = 'pass';
    } else if (w) {
      r.status = filled(w.by) && filled(w.reason) ? 'waived' : 'invalid';
      if (r.status === 'invalid') r.why = 'a waiver needs "by" and "reason"';
    } else if (applies) {
      Object.assign(r, { status: 'uncovered', why: c.must });
    }
    results.push(r);
  }
  for (const g of guards) {
    if (!CATALOGUE.some((c) => c.id === g.id)) results.push({ id: g.id, applies: null, status: 'invalid', why: 'unknown contract id' });
  }
  return { ok: results.every((r) => ['pass', 'waived', 'n/a'].includes(r.status)), results };
}
