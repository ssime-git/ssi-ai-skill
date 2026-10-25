import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadConfig, opAllowed } from './config.mjs';
import { readState, writeState, newState, PHASES } from './state.mjs';
import { gitFacts, makeRunner } from './git.mjs';
import { computeNext } from './next.mjs';
import { applyRecord } from './record.mjs';
import { applyAnswer } from './stops.mjs';
import { createIssue, closedPrNumbers, isTransient, findPr, readCi } from './github.mjs';
import { evaluateGuards } from './guards.mjs';
import { uploadAsset, purgeAssets } from './assets.mjs';
import { targetOf } from './workflow.mjs';
import { detectPhase } from './detect.mjs';
import { evaluateStops } from './stops.mjs';
import { readEvidence, saveExecution, executeCheck } from './evidence.mjs';

const USAGE = 'Usage: ssi <start|next|check|ci|record|answer|config|allow|issue|upload|purge|guards> [options]\n';

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[a.slice(2)] = true;
      else {
        flags[a.slice(2)] = next;
        i++;
      }
    } else pos.push(a);
  }
  return { pos, flags };
}

// The base branch and the branch we are on are source branches: assets must never go there.
function sourceBranches(run) {
  const f = gitFacts(run);
  return [f.base, f.base?.replace(/^origin\//, ''), f.branch].filter(Boolean);
}

const csv = (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : undefined);
const truthy = (v) => v !== undefined && v !== 'false';

export function main(argv, { cwd, gh, run, write }) {
  const separator = argv.indexOf('--');
  const command = separator < 0 ? [] : argv.slice(separator + 1);
  const { pos, flags } = parseArgs(separator < 0 ? argv : argv.slice(0, separator));
  const [cmd, sub] = pos;
  const out = (o) => write(JSON.stringify(o, null, 2) + '\n');
  try {
    const overrides = flags.style ? { ui: { style: flags.style } } : {};
    if (flags.target || flags.scope) overrides.workflow = {
      ...(flags.target ? { target: flags.target } : {}), ...(flags.scope ? { scope: flags.scope } : {}),
    };
    const config = loadConfig({ cwd, flags: overrides });
    const needState = () => {
      const { state } = readState(cwd);
      if (!state) throw new Error('No active run yet, so there is nothing to continue. Begin one with: ssi start "<request>"');
      return state;
    };
    const factsFor = (state) => gitFacts(run, { local: targetOf(state) !== 'pr', startSha: state.start_sha });
    const requirePhase = (state, phase, facts) => {
      const current = detectPhase({ state, facts, config }).phase;
      if (current !== phase && !(phase === 5 && current > 5 && state.evidence.implement)) {
        throw new Error(`Phase ${phase} is not current; complete phase ${current} first (ssi next).`);
      }
      const stop = evaluateStops({ state, facts, config, phase });
      if (stop) throw new Error(`${stop.code}: ${stop.because} Run ssi next to handle it.`);
    };
    switch (cmd) {
      case 'config':
        out(config);
        return 0;
      case 'guards': {
        const g = evaluateGuards(cwd, { changedFiles: factsFor(readState(cwd).state ?? { workflow: config.workflow }).changedFiles });
        out(g);
        return g.ok ? 0 : 1;
      }
      case 'allow': {
        const allowed = opAllowed(sub, config);
        out({ op: sub, allowed });
        return allowed ? 0 : 1;
      }
      case 'start': {
        const goal = pos.slice(1).join(' ').trim();
        if (!goal) throw new Error('Usage: ssi start "<request>"');
        const { state: old } = readState(cwd);
        if (old && !flags.force && !old.last?.done && !old.evidence?.land) throw new Error(`A run is already active: "${old.goal}". Finish it first, or add --force if you really want to drop it and start over.`);
        const s = newState(goal, config.workflow);
        s.start_sha = gitFacts(run).headSha ?? 'EMPTY';
        writeState(cwd, s);
        out({ ok: true, run_id: s.run_id });
        return 0;
      }
      case 'next': {
        const next = computeNext({ cwd, config, run, gh });
        out(flags.compact ? {
          done: next.done, phase: next.phase,
          ...(next.action ? { action: { kind: next.action.kind, instructions: next.action.instructions, refs: next.action.refs } } : {}),
          ...(next.stop ? { stop: next.stop } : {}),
          ...(next.warnings.length ? { warnings: next.warnings } : {}),
        } : next);
        return 0;
      }
      case 'check': {
        if (Object.keys(flags).some((f) => !['phase', 'expect-exit'].includes(f))) throw new Error('check accepts only --phase and --expect-exit before the command separator (--).');
        const state = needState();
        const phase = Number(flags.phase ?? 5);
        if (![2, 3, 5].includes(phase)) throw new Error('check supports phases 2, 3 and 5.');
        if (!command.length) throw new Error('Usage: ssi check --phase 5 -- <command> [arguments]');
        const before = factsFor(state);
        requirePhase(state, phase, before);
        const receipt = executeCheck(run, command[0], command.slice(1), Number(flags['expect-exit'] ?? 0));
        const after = factsFor(state);
        if (before.headSha !== after.headSha || before.tree !== after.tree || (targetOf(state) === 'pr' && (before.dirty || after.dirty))) {
          receipt.pass = false;
          receipt.error = 'The code changed during verification, or the PR tree is uncommitted. Commit PR changes, then re-run.';
        }
        const evidence = saveExecution(cwd, { ...receipt, sha: after.headSha, tree: after.tree, at: new Date().toISOString() });
        const previous = phase === 5 ? state.evidence.implement : null;
        const checks = previous?.sha === after.headSha && previous?.tree === after.tree ? previous.checks ?? [previous.path] : [];
        applyRecord(state, { phase, result: receipt.pass ? 'pass' : 'fail', evidence,
          proof: { ...readEvidence(cwd, evidence), level: 'executed',
            ...((phase === 5 || targetOf(state) === 'answer') ? { tree: after.tree } : {}), checks: [...checks, evidence] } }, after.headSha);
        writeState(cwd, state);
        out({ pass: receipt.pass, exitCode: receipt.exitCode, evidence, ...(receipt.error ? { error: receipt.error } : {}),
          ...(receipt.pass ? {} : { output: receipt.output.slice(-2000) }) });
        return receipt.pass ? 0 : 1;
      }
      case 'ci': {
        const state = needState();
        if (targetOf(state) !== 'pr') throw new Error('CI publication checks apply only to a PR run.');
        const facts = factsFor(state);
        requirePhase(state, 8, facts);
        const pr = findPr(gh, facts.branch, state.pr);
        if (!pr || pr.state !== 'OPEN' || facts.dirty) throw new Error('CI requires a clean tree and an open PR.');
        const guards = evaluateGuards(cwd, { changedFiles: facts.changedFiles });
        if (!guards.ok) throw new Error('Run ssi guards: applicable contracts are not proven.');
        const result = readCi(gh, pr.number, facts.headSha);
        if (result.pending) { out({ pending: true, note: 'Checks are pending; wait before retrying ssi ci.' }); return 0; }
        const evidence = saveExecution(cwd, { ...result, sha: facts.headSha, at: new Date().toISOString() });
        applyRecord(state, { phase: 8, result: result.pass ? 'pass' : 'fail', evidence, note: result.note,
          proof: { ...readEvidence(cwd, evidence), level: 'executed' } }, facts.headSha);
        writeState(cwd, state);
        out({ pass: result.pass, checks: result.checks.length, note: result.note, evidence });
        return result.pass ? 0 : 1;
      }
      case 'record': {
        const state = needState();
        const phase = Number(flags.phase);
        if (!Number.isInteger(phase) || !PHASES[phase - 1]) throw new Error(`Unknown phase: ${flags.phase}`);
        const KNOWN = ['phase', 'result', 'evidence', 'surface', 'note', 'kind', 'gaps', 'touches', 'public-api'];
        const unknown = Object.keys(flags).filter((k) => !KNOWN.includes(k));
        if (unknown.length) {
          throw new Error(`Unknown option for record: ${unknown.map((k) => '--' + k).join(', ')}. Allowed: ${KNOWN.map((k) => '--' + k).join(' ')}`);
        }
        if (flags.result === 'pass' && phase === 6 && !/independent:\s*(yes|no)\b/i.test(typeof flags.note === 'string' ? flags.note : '')) {
          throw new Error('Review needs --note "<reviewer>; independent: yes|no". Say "yes" only if someone else did the review, such as Codex or a different model. A fresh helper running the same model as you counts as "no".');
        }
        if (flags.result === 'pass' && phase === 8 && (typeof flags.note !== 'string' || !flags.note.trim())) {
          throw new Error('Land needs --note saying what the automatic checks (CI) showed: "checks green", or "no CI configured" if the project has none.');
        }
        if (flags.result === 'pass' && [5, 8].includes(phase)) throw new Error(phase === 5 ? 'Use ssi check --phase 5 -- <command> to record executed verification.' : 'Use ssi ci to inspect the real GitHub checks.');
        const here = factsFor(state);
        if (flags.result === 'pass' && targetOf(state) === 'pr' && [5, 6, 7].includes(phase) && here.dirty) {
          throw new Error('You have changes that are not saved in a commit yet. Commit them first, so the proof covers the code that will really ship.');
        }
        let proof;
        if (flags.result === 'pass') {
          proof = { ...readEvidence(cwd, flags.evidence, { review: phase === 6 }), level: 'reported',
            ...((phase >= 5 || targetOf(state) === 'answer') ? { tree: here.tree } : {}) };
          requirePhase(state, phase, here);
        }
        if (flags.kind && !['bug', 'feature'].includes(flags.kind)) throw new Error('--kind must be bug or feature.');
        if (flags.gaps !== undefined && (!Number.isInteger(Number(flags.gaps)) || Number(flags.gaps) < 0)) throw new Error('--gaps must be a non-negative integer.');
        applyRecord(state, {
          phase,
          result: flags.result,
          evidence: typeof flags.evidence === 'string' ? flags.evidence : undefined,
          surface: csv(flags.surface),
          note: typeof flags.note === 'string' ? flags.note : undefined,
          kind: typeof flags.kind === 'string' ? flags.kind : undefined,
          gaps: flags.gaps === undefined ? undefined : Number(flags.gaps),
          touches: csv(flags.touches),
          publicApi: truthy(flags['public-api']),
          proof,
        }, here.headSha);
        writeState(cwd, state);
        out({ ok: true, recorded: PHASES[phase - 1], attempts: state.attempts });
        return 0;
      }
      case 'answer': {
        const state = needState();
        const here = gitFacts(run);
        try {
          here.pr = state.branch ? findPr(gh, state.branch, state.pr) : null;
        } catch {
          here.pr = null;
        }
        applyAnswer(state, here, pos.slice(1).join(' '));
        writeState(cwd, state);
        out({ ok: true, stop: state.stop });
        return 0;
      }
      case 'issue': {
        const state = needState();
        if (sub === 'skip') {
          state.issue_skipped = typeof flags.because === 'string' ? flags.because : 'skipped';
          state.pending = state.pending.filter((p) => p.op !== 'issue');
          writeState(cwd, state);
          out({ ok: true, skipped: state.issue_skipped });
          return 0;
        }
        if (sub !== 'create') throw new Error('Usage: ssi issue create --title T [--body B] | ssi issue skip --because R');
        if (!opAllowed('issue', config)) throw new Error('The settings do not allow creating issues.');
        if (typeof flags.title !== 'string' || !flags.title.trim()) throw new Error('--title is required.');
        const body = typeof flags.body === 'string' ? flags.body : '';
        const followup = truthy(flags['follow-up']);
        const key = followup ? `ssi:${state.run_id}:followup:${createHash('sha256').update(flags.title.trim()).digest('hex').slice(0, 12)}` : `ssi:${state.run_id}:issue`;
        try {
          const r = createIssue(gh, { title: flags.title, body, key });
          if (followup) state.followups = [...new Set([...state.followups, r.number])];
          else state.issue = r.number;
          writeState(cwd, state);
          out({ ok: true, issue: r.number, created: r.created });
        } catch (e) {
          if (!isTransient(e)) throw e;
          if (!state.pending.some((p) => p.key === key)) state.pending.push({ op: 'issue', title: flags.title, body, key, followup });
          writeState(cwd, state);
          out({ ok: true, queued: true, because: e.message });
        }
        return 0;
      }
      case 'upload': {
        const state = needState();
        const pr = flags.pr ?? state.pr;
        if (!pr) throw new Error('There is no pull request yet. Open the draft one first.');
        if (!opAllowed('push', config)) throw new Error('The settings do not allow pushing code online.');
        out(uploadAsset({ run, branch: config.assets.branch, pr, file: resolve(cwd, flags.file), push: true, forbid: sourceBranches(run) }));
        return 0;
      }
      case 'purge': {
        if (!config.assets.purge) {
          out({ skipped: true });
          return 0;
        }
        const dry = truthy(flags['dry-run']);
        out(purgeAssets({ run, branch: config.assets.branch, closed: closedPrNumbers(gh), push: opAllowed('push', config) && !dry, dryRun: dry, forbid: sourceBranches(run) }));
        return 0;
      }
      default:
        write(USAGE);
        return 2;
    }
  } catch (e) {
    write(JSON.stringify({ error: e.message }) + '\n');
    return 1;
  }
}
