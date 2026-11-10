import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = Object.freeze({
  workflow: { target: 'local', scope: 'standard', issues: 'optional' },
  mandate: { allow: ['push', 'draft-pr', 'issue', 'comment'], ready: false },
  thresholds: {
    diff: { lines: 300, files: 8 },
    analysisRetries: 3,
    reproAttempts: 3,
    planRetries: 3,
    implementRetries: 3,
    reviewRounds: 2,
    visualRetries: 2,
    ciRetries: 2,
  },
  review: { reviewers: ['codex', 'subagent'], parallel: false, codexModel: '', codexEffort: '', roles: ['ui', 'ux', 'security', 'data'] },
  models: {
    tiers: { fast: '', balanced: '', deep: '' },
    steps: { analyze: 'fast', confirm: 'fast', reproduce: 'balanced', plan: 'balanced', implement: 'balanced', review: 'deep', visual: 'fast', land: 'fast' },
  },
  ci: { watch: true, reviewComments: false },
  visual: { enabled: 'auto', tool: 'playwright' },
  assets: { branch: 'tracer-assets', purge: true },
  protectedPaths: ['**/auth/**', '**/payment*/**', '**/migrations/**', '**/schema*'],
  // Existing files the builder may not modify or delete without an explicit, per-file approval.
  frozenPaths: ['**/*.test.*', '**/*.spec.*', '**/test_*.py', '**/*_test.*', '**/tests/**', '**/__tests__/**', 'tracer.config.json', 'tracer.guards.json', '.github/workflows/**'],
  ui: { style: 'plain' },
});

export const FORBIDDEN_OPS = Object.freeze(['merge', 'close-issue', 'deploy']);
const KNOWN_OPS = ['push', 'draft-pr', 'issue', 'comment'];
const ENUMS = {
  'workflow.target': ['answer', 'local', 'pr'],
  'workflow.scope': ['small', 'standard'],
  'workflow.issues': ['optional', 'required'],
  'visual.enabled': ['auto', 'on', 'off'],
  'ui.style': ['guided', 'adhd', 'plain'],
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const at = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

export function validate(over, base = DEFAULTS, path = '') {
  if (!isObj(over)) throw new Error('Config must be a JSON object');
  for (const [k, v] of Object.entries(over)) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in base)) throw new Error(`Unknown config key: ${p}`);
    const b = base[k];
    if (isObj(b)) {
      if (!isObj(v)) throw new Error(`Config key ${p} must be an object`);
      validate(v, b, p);
    } else if (Array.isArray(b)) {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
        throw new Error(`Config key ${p} must be an array of strings`);
      }
    } else if (typeof v !== typeof b) {
      throw new Error(`Config key ${p} must be a ${typeof b}`);
    }
  }
  if (path === '') checkValues(over);
}

function checkValues(over) {
  for (const [p, allowed] of Object.entries(ENUMS)) {
    const v = at(over, p);
    if (v !== undefined && !allowed.includes(v)) {
      throw new Error(`Config key ${p} must be one of: ${allowed.join(', ')}`);
    }
  }
  for (const [step, tier] of Object.entries(at(over, 'models.steps') ?? {})) {
    if (!['analyze', 'confirm', 'reproduce', 'plan', 'implement', 'review', 'visual', 'land'].includes(step)) throw new Error(`Unknown step in models.steps: ${step}`);
    if (!['fast', 'balanced', 'deep'].includes(tier)) throw new Error(`models.steps.${step} must be one of: fast, balanced, deep`);
  }
  for (const [tier, name] of Object.entries(at(over, 'models.tiers') ?? {})) {
    if (name !== '' && !/^[\w.:-]+$/.test(name)) throw new Error(`models.tiers.${tier} may only contain letters, digits, dots, colons, dashes and underscores`);
  }
  for (const r of at(over, 'review.roles') ?? []) {
    if (!['ui', 'ux', 'security', 'data'].includes(r)) throw new Error(`Unknown review role: ${r}`);
  }
  const ab = at(over, 'assets.branch');
  if (ab !== undefined && (!/^[A-Za-z0-9._][A-Za-z0-9._\/-]*$/.test(ab) || ['main', 'master', 'trunk', 'develop', 'HEAD'].includes(ab))) {
    throw new Error('Config key assets.branch must be a plain branch name that is not a source branch (main, master, trunk, develop)');
  }
  for (const p of ['review.codexModel', 'review.codexEffort']) {
    const v = at(over, p);
    if (v !== undefined && v !== '' && !/^[\w.-]+$/.test(v)) throw new Error(`Config key ${p} may only contain letters, digits, dots, dashes and underscores`);
  }
  for (const op of at(over, 'mandate.allow') ?? []) {
    if (FORBIDDEN_OPS.includes(op)) throw new Error(`"${op}" can never be allowed by config`);
    if (!KNOWN_OPS.includes(op)) throw new Error(`Unknown mandate operation: ${op}`);
  }
  const walk = (o, p) => {
    for (const [k, v] of Object.entries(o)) {
      const q = `${p}.${k}`;
      if (isObj(v)) walk(v, q);
      else if (!Number.isInteger(v) || v < 1) throw new Error(`Config key ${q} must be a positive integer`);
    }
  };
  if (over.thresholds) walk(over.thresholds, 'thresholds');
}

export function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

function readJson(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`invalid JSON (${e.message})`);
  }
}

export function loadConfig({ cwd, flags = {} }) {
  let cfg = structuredClone(DEFAULTS);
  const layers = [
    ['tracer.config.json', () => readJson(join(cwd, 'tracer.config.json'))],
    ['.tracer/config.local.json', () => readJson(join(cwd, '.tracer', 'config.local.json'))],
    ['flags', () => flags],
  ];
  for (const [name, load] of layers) {
    try {
      const over = load();
      if (!over) continue;
      validate(over);
      cfg = merge(cfg, over);
    } catch (e) {
      throw new Error(`${name}: ${e.message}`);
    }
  }
  return cfg;
}

export function opAllowed(op, config) {
  if (FORBIDDEN_OPS.includes(op)) return false;
  if (op === 'ready') return config.mandate.ready === true;
  return config.mandate.allow.includes(op);
}
