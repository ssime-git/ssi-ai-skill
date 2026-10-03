import { resolve } from 'node:path';
import { loadConfig, opAllowed } from './config.mjs';
import { readState, writeState, newState, PHASES } from './state.mjs';
import { gitFacts, makeRunner } from './git.mjs';
import { computeNext } from './next.mjs';
import { applyRecord } from './record.mjs';
import { applyAnswer } from './stops.mjs';
import { createIssue, closedPrNumbers, isTransient } from './github.mjs';
import { uploadAsset, purgeAssets } from './assets.mjs';

const USAGE = 'Usage: ssi <start|next|record|answer|config|allow|issue|upload|purge> [options]\n';

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

const csv = (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : undefined);
const truthy = (v) => v !== undefined && v !== 'false';

export function main(argv, { cwd, gh, run, write }) {
  const { pos, flags } = parseArgs(argv);
  const [cmd, sub] = pos;
  const out = (o) => write(JSON.stringify(o, null, 2) + '\n');
  try {
    const config = loadConfig({ cwd, flags: flags.style ? { ui: { style: flags.style } } : {} });
    const needState = () => {
      const { state } = readState(cwd);
      if (!state) throw new Error('No active run. Run: ssi start "<request>"');
      return state;
    };
    switch (cmd) {
      case 'config':
        out(config);
        return 0;
      case 'allow': {
        const allowed = opAllowed(sub, config);
        out({ op: sub, allowed });
        return allowed ? 0 : 1;
      }
      case 'start': {
        const goal = pos.slice(1).join(' ').trim();
        if (!goal) throw new Error('Usage: ssi start "<request>"');
        const { state: old } = readState(cwd);
        if (old && !flags.force && !old.evidence?.land) throw new Error(`A run is already active: "${old.goal}". Use --force to replace it.`);
        const s = newState(goal);
        s.start_sha = gitFacts(run).headSha ?? 'EMPTY';
        writeState(cwd, s);
        out({ ok: true, run_id: s.run_id });
        return 0;
      }
      case 'next':
        out(computeNext({ cwd, config, run, gh }));
        return 0;
      case 'record': {
        const state = needState();
        const phase = Number(flags.phase);
        const here = gitFacts(run);
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
        }, here.headSha);
        writeState(cwd, state);
        const dirty = phase >= 5 && flags.result === 'pass' && here.dirty;
        out({ ok: true, recorded: PHASES[phase - 1], attempts: state.attempts, ...(dirty ? { warning: 'You have uncommitted changes. This proof covers the committed code only.' } : {}) });
        return 0;
      }
      case 'answer': {
        const state = needState();
        applyAnswer(state, gitFacts(run), pos.slice(1).join(' '));
        writeState(cwd, state);
        out({ ok: true, stop: state.stop });
        return 0;
      }
      case 'issue': {
        const state = needState();
        if (sub === 'skip') {
          state.issue_skipped = typeof flags.because === 'string' ? flags.because : 'skipped';
          writeState(cwd, state);
          out({ ok: true, skipped: state.issue_skipped });
          return 0;
        }
        if (sub !== 'create') throw new Error('Usage: ssi issue create --title T [--body B] | ssi issue skip --because R');
        if (!opAllowed('issue', config)) throw new Error('The config does not allow creating issues.');
        if (typeof flags.title !== 'string' || !flags.title.trim()) throw new Error('--title is required.');
        const body = typeof flags.body === 'string' ? flags.body : '';
        try {
          const r = createIssue(gh, { title: flags.title, body, key: `ssi:${state.run_id}:issue` });
          state.issue = r.number;
          writeState(cwd, state);
          out({ ok: true, issue: r.number, created: r.created });
        } catch (e) {
          if (!isTransient(e)) throw e;
          state.pending.push({ op: 'issue', title: flags.title, body });
          writeState(cwd, state);
          out({ ok: true, queued: true, because: e.message });
        }
        return 0;
      }
      case 'upload': {
        const state = needState();
        const pr = flags.pr ?? state.pr;
        if (!pr) throw new Error('There is no PR yet. Open the draft PR first.');
        if (!opAllowed('push', config)) throw new Error('The config does not allow pushing.');
        out(uploadAsset({ run, branch: config.assets.branch, pr, file: resolve(cwd, flags.file), push: true }));
        return 0;
      }
      case 'purge': {
        if (!config.assets.purge) {
          out({ skipped: true });
          return 0;
        }
        const dry = truthy(flags['dry-run']);
        out(purgeAssets({ run, branch: config.assets.branch, closed: closedPrNumbers(gh), push: opAllowed('push', config) && !dry, dryRun: dry }));
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
