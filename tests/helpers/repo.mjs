import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function commit(dir, file, content, msg) {
  const p = join(dir, file);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  git(dir, 'add', file);
  git(dir, 'commit', '-q', '-m', msg);
  return git(dir, 'rev-parse', 'HEAD');
}

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ssi-repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t.t');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'commit.gpgsign', 'false');
  commit(dir, 'README.md', '# t\n', 'init');
  return dir;
}
