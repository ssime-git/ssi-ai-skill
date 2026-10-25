import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo, commit, git } from './repo.mjs';
import { makeGhStub } from './gh.mjs';
import { makeRunner } from '../../skills/ssi/scripts/lib/git.mjs';
import { main } from '../../skills/ssi/scripts/lib/cli.mjs';

export function session() {
  const dir = makeRepo();
  const gh = makeGhStub();
  const ssi = (...args) => {
    let text = '';
    const code = main(args, { cwd: dir, gh, run: makeRunner(dir), write: (s) => { text += s; } });
    return { code, json: text.trim().startsWith('{') ? JSON.parse(text) : text };
  };
  const artifact = (name, content) => {
    const file = join(dir, '.ssi', name);
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  };
  const record = (phase, ...args) => {
    const content = phase === 6 ? { verdict: 'approve', summary: 'Fixture reviewed', findings: [] } : `Fixture evidence for phase ${phase}`;
    const file = artifact(`phase-${phase}.json`, content);
    const r = ssi('record', '--phase', String(phase), '--result', 'pass', '--evidence', file,
      ...(phase === 6 ? ['--note', 'fixture reviewer; independent: no'] : []), ...args);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    return r;
  };
  const check = () => {
    const r = ssi('check', '--phase', '5', '--', 'node', '-e', 'process.exit(0)');
    assert.equal(r.code, 0, JSON.stringify(r.json));
    return r;
  };
  return { dir, gh, ssi, artifact, record, check };
}

export function reach(phase) {
  const ctx = session();
  const { dir, gh, ssi, record, check } = ctx;
  commit(dir, 'ssi.config.json', JSON.stringify({ visual: { enabled: 'on' } }), 'fixture config');
  ssi('start', 'Fix the fixture bug', '--target', 'pr');
  if (phase > 1) record(1, '--kind', 'bug', '--gaps', '0');
  if (phase > 2) record(2);
  if (phase > 3) record(3);
  if (phase > 4) {
    record(4, '--touches', 'src/calc.js');
    git(dir, 'switch', '-q', '-c', 'ssi/fix');
    commit(dir, 'src/calc.js', 'export const total = (n) => n;\n', 'fix');
    gh.openPr(1, 'ssi/fix', true, git(dir, 'rev-parse', 'HEAD'));
  }
  if (phase > 5) check();
  if (phase > 6) record(6);
  if (phase > 7) record(7);
  return ctx;
}
