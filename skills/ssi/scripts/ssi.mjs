#!/usr/bin/env node
import { main } from './lib/cli.mjs';
import { makeRunner } from './lib/git.mjs';
import { makeGh } from './lib/github.mjs';

const cwd = process.cwd();
process.exitCode = main(process.argv.slice(2), {
  cwd,
  gh: makeGh(cwd),
  run: makeRunner(cwd),
  write: (s) => process.stdout.write(s),
});
