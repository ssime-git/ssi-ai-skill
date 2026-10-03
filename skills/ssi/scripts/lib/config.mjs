import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = Object.freeze({
  mandate: { allow: ['push', 'draft-pr', 'issue', 'comment'], ready: false },
  thresholds: {
    diff: { lines: 300, files: 8 },
    reproAttempts: 3,
    reviewRounds: 2,
    visualRetries: 2,
    ciRetries: 2,
  },
  review: { reviewers: ['codex', 'subagent'], parallel: false },
  ci: { watch: true, reviewComments: false },
  visual: { enabled: 'auto', tool: 'playwright' },
  assets: { branch: 'ssi-assets', purge: true },
  protectedPaths: ['**/auth/**', '**/payment*/**', '**/migrations/**', '**/schema*'],
  ui: { style: 'guided' },
});

export const FORBIDDEN_OPS = Object.freeze(['merge', 'close-issue', 'deploy']);
const KNOWN_OPS = ['push', 'draft-pr', 'issue', 'comment'];
const ENUMS = {
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
    ['ssi.config.json', () => readJson(join(cwd, 'ssi.config.json'))],
    ['.ssi/config.local.json', () => readJson(join(cwd, '.ssi', 'config.local.json'))],
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
