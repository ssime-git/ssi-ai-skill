import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo, commit, git } from '../helpers/repo.mjs';
import { makeGhStub } from '../helpers/gh.mjs';
import { makeRunner } from '../../skills/ssi/scripts/lib/git.mjs';
import { main } from '../../skills/ssi/scripts/lib/cli.mjs';

function cli(dir, gh) {
  return (...argv) => {
    let out = '';
    const code = main(argv, { cwd: dir, gh, run: makeRunner(dir), write: (s) => { out += s; } });
    return { code, json: out.trim().startsWith('{') ? JSON.parse(out) : out };
  };
}

// Bring a fresh run up to the point where `phase` is the current one (1..8).
function reach(phase) {
  const dir = makeRepo();
  writeFileSync(join(dir, 'ssi.config.json'), JSON.stringify({ visual: { enabled: 'on' } }));
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'config');
  const gh = makeGhStub();
  const ssi = cli(dir, gh);
  ssi('start', 'Fix login crash');
  const pass = (p, ...a) => { const r = ssi('record', '--phase', String(p), '--result', 'pass', ...a); assert.equal(r.code, 0, p + ' ' + JSON.stringify(r.json)); };
  if (phase > 1) pass(1, '--gaps', '0', '--kind', 'bug', '--evidence', 'brief.md');
  if (phase > 2) pass(2, '--evidence', 'proof.txt');
  if (phase > 3) pass(3, '--evidence', 'repro.test.js');
  if (phase > 3) ssi('issue', 'create', '--title', 'Login crashes', '--body', 'details');
  if (phase > 4) {
    pass(4, '--evidence', 'plan.md', '--touches', 'src/login.js');
    git(dir, 'checkout', '-q', '-b', 'ssi/fix-login');
    commit(dir, 'src/login.js', 'fixed\n', 'fix');
    gh.openPr(1, 'ssi/fix-login');
  }
  if (phase > 5) pass(5, '--evidence', 'tests.txt', '--surface', 'src');
  if (phase > 6) pass(6, '--note', 'codex; independent: yes');
  if (phase > 7) pass(7, '--evidence', 'shot.png');
  return { dir, ssi };
}

// phase -> [phase the run returns to after one fail, stop code, max fails before the stop]
const MATRIX = {
  1: [1, 'STOP_ANALYSIS', 3],
  2: [1, 'STOP_ANALYSIS', 3],
  3: [3, 'STOP_NO_REPRO', 3],
  4: [4, 'STOP_PLAN', 3],
  5: [5, 'STOP_IMPLEMENT', 3],
  6: [5, 'STOP_REVIEW', 2],
  7: [5, 'STOP_VISUAL', 2],
  8: [5, 'STOP_CI', 2],
};

for (const [p, [back, code, max]] of Object.entries(MATRIX)) {
  test(`repeated fail in phase ${p} returns to phase ${back} and ends in ${code}`, () => {
    const { ssi } = reach(Number(p));
    let stopped = null;
    for (let i = 1; i <= max + 1 && !stopped; i++) {
      const rr = ssi('record', '--phase', p, '--result', 'fail', '--evidence', 'x'); assert.equal(rr.code, 0, JSON.stringify(rr.json));
      const n = ssi('next').json;
      if (n.stop) { stopped = { n, i }; break; }
      assert.equal(n.phase, back, `after fail #${i} of phase ${p}`);
    }
    assert.ok(stopped, `phase ${p} never stops`);
    assert.equal(stopped.n.stop.code, code);
    assert.ok(stopped.i <= max, `stop came after ${stopped.i} fails, expected <= ${max}`);
    const ans = ssi('answer', 'A try something else'); if (ans.code) console.log(p, ans.json);
    assert.equal(ans.code, 0);
    assert.equal(ssi('next').json.stop, null);
  });
}
