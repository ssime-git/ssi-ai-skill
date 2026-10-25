import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export function readEvidence(cwd, file, { review = false } = {}) {
  if (!file) throw new Error('--evidence must name an existing, non-empty artifact.');
  const content = readFileSync(resolve(cwd, file));
  if (!content.length) throw new Error('The evidence file is empty.');
  if (review) {
    const report = JSON.parse(content.toString('utf8'));
    if (report.verdict !== 'approve' || typeof report.summary !== 'string' || !report.summary.trim()
      || !Array.isArray(report.findings)) throw new Error('Review must be JSON with verdict "approve", a summary and findings.');
    if (report.findings.some((f) => !['critical', 'high', 'medium', 'low'].includes(f.severity))) {
      throw new Error('Each review finding needs a recognized severity.');
    }
    if (report.findings.some((f) => ['critical', 'high'].includes(f.severity))) {
      throw new Error('Resolve blocking review findings before recording a pass.');
    }
  }
  return { digest: createHash('sha256').update(content).digest('hex'), bytes: content.length };
}

export function saveExecution(cwd, receipt) {
  const dir = join(cwd, '.ssi', 'evidence');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${Date.now()}-${randomBytes(3).toString('hex')}.json`);
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
  return path;
}

// Arguments are executed directly, without a shell. An expected test failure is not
// the same as a missing executable, a signal, a timeout or a runner error.
export function executeCheck(run, command, args, expected = 0) {
  if (!Number.isInteger(expected) || expected < 0 || expected > 125) throw new Error('--expect-exit must be an integer from 0 to 125.');
  let output = '';
  let exitCode = 0;
  let error = null;
  try { output = run(command, args); }
  catch (e) {
    exitCode = Number.isInteger(e.status) ? e.status : null;
    output = String(e.stdout ?? '') + String(e.stderr ?? '');
    if (e.code || e.signal || exitCode === null || exitCode >= 126) error = e.code ?? e.signal ?? e.message;
  }
  return { command, args, expected, exitCode, output, error, pass: !error && exitCode === expected };
}
