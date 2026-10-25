import { parseOpenItems } from './open-items.mjs';
import { targetOf } from './workflow.mjs';
const ref = (n) => [`references/${n}.md`];

const AFTER_PUSH = new Set(['review', 'visual', 'land', 'done']);

// Values reach a shell command line: allow only safe characters, else fall back.
function safeToken(v, fallback) {
  return typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(v) && !v.includes('..') ? v : fallback;
}

export function actionFor({ name, state, facts, config }) {
  const target = targetOf(state);
  if (target !== 'pr') {
    if (name === 'implement') return {
      kind: 'implement-local', headline: 'Make the smallest useful change and verify it',
      instructions: 'Read the relevant code and callers. Reuse existing code; make the requested change locally. For a bug, keep the reproduction as a regression test. Run: ssi check --phase 5 -- <verification command>. No commit, Issue, push or PR is required.',
      refs: ref('implement'), requires: [],
    };
    if (name === 'visual') return {
      kind: 'capture-visual', headline: 'Check the changed screen or interaction',
      instructions: 'Check the affected flow with the available browser. Save a screenshot, or a short recording only when motion matters. Record phase 7 with the artifact path and what was observed. Keep it local; do not upload it.',
      refs: ref('visual'), requires: [],
    };
    if (name === 'done') return {
      kind: 'done', headline: target === 'answer' ? 'The analysis is ready' : 'The local change is verified',
      instructions: 'Give the requested answer or summarize the local diff. State the checks actually executed, their limits, and any useful deferred work. Do not publish anything.',
      refs: [], requires: [],
    };
  }
  // GitHub reports the new PR head a few seconds after a push; our own remote-tracking ref is immediate.
  const pushed = facts.remoteSha && facts.remoteSha === facts.headSha;
  if (target === 'pr' && AFTER_PUSH.has(name) && facts.pr?.headSha && facts.pr.headSha !== facts.headSha && !pushed) {
    return {
      kind: 'push-changes',
      headline: 'Push your latest commits to the PR',
      instructions: 'The PR is behind your local branch. Run: git push. Then run: ssi next.',
      refs: ref('implement'),
      requires: ['push'],
    };
  }
  if (target === 'pr' && AFTER_PUSH.has(name) && !facts.pr && !facts.prUnknown) {
    return {
      kind: 'open-draft-pr',
      headline: 'Push the branch and open a draft PR',
      instructions: 'There is no open PR for this branch. Push it, then run: gh pr create --draft --title "<title>" --body "<summary; Closes #<issue> if there is one>". Then run: ssi next.',
      refs: ref('implement'),
      requires: ['push', 'draft-pr'],
    };
  }
  switch (name) {
    case 'analyze':
      return {
        kind: 'analyze',
        headline: 'Read the request and list what is missing',
        instructions: 'Read the request and the code it touches. Write the goal, one observable success check, and every gap. Then run: ssi record --phase 1 --result pass --gaps <number of blocking gaps> --kind bug|feature --evidence <brief file>.',
        refs: ref('analyze'),
        requires: [],
      };
    case 'confirm':
      return {
        kind: 'confirm',
        headline: 'Prove the gap or the bug with a fact',
        instructions: 'Prove it with a fact: a failing command, a log line or the exact code path. Then run: ssi record --phase 2 --result pass|fail --evidence <proof>. If you cannot prove it, record fail.',
        refs: ref('confirm'),
        requires: [],
      };
    case 'reproduce':
      if (state.evidence.reproduce) {
        return {
          kind: 'open-issue',
          headline: 'Open the Issue for this bug',
          instructions: 'Run: ssi issue create --title "<bug title>" --body "<what fails, how to replay, artifact path>".',
          refs: ref('reproduce'),
          requires: [],
        };
      }
      return {
        kind: 'reproduce',
        headline: 'Build a replayable failing artifact',
        instructions: 'Choose the method by bug type, build a replayable artifact, run it and watch it fail. Then run: ssi record --phase 3 --result pass|fail --evidence <artifact path>.',
        refs: ref('reproduce'),
        requires: [],
      };
    case 'plan':
      return {
        kind: 'plan',
        headline: 'Write the smallest plan that reuses what exists',
        instructions: 'Search for code to reuse first, then write the smallest useful plan. Keep unrelated ideas in the handoff or an optional authorized Issue. Then run: ssi record --phase 4 --result pass --evidence <plan file> --touches <comma-separated files> [--public-api].',
        refs: ref('plan'),
        requires: [],
      };
    case 'implement':
      if (facts.onBase) {
        return {
          kind: 'create-branch',
          headline: 'Create a working branch first',
          instructions: `You are on ${facts.base ?? 'the base branch'}. Run: git switch -c ssi/<short-name> (any commits you made come with you). Never push the base branch. Then run: ssi next.`,
          refs: ref('implement'),
          requires: [],
        };
      }
      if (facts.workCommits === 0) {
        const retry = ['review', 'visual', 'land'].some((n) => (state.attempts?.[n] ?? 0) > 0);
        return retry
          ? {
              kind: 'implement',
              headline: 'Fix what the last check found',
              instructions: `Read what the ${state.last_failure?.phase ?? 'last'} check reported${state.last_failure?.evidence ? ` (report: ${state.last_failure.evidence})` : ''}${state.last_failure?.note ? `. Note: ${state.last_failure.note}` : ''}. Fix it, add or adjust a test for it, and commit. Then run: ssi next.`,
              refs: ref('implement'),
              requires: [],
            }
          : {
              kind: 'implement',
              headline: 'Write the failing test first, then the code',
              instructions: `Write the failing test, make it pass, commit in small steps (on a branch ssi/<short-name>, never on ${facts.base ?? 'the base branch'}). Then run: ssi next.`,
              refs: ref('implement'),
              requires: [],
            };
      }
      if (!facts.pr && !facts.prUnknown) {
        return {
          kind: 'open-draft-pr',
          headline: 'Push the branch and open a draft PR',
          instructions: 'Push the branch, then run: gh pr create --draft --title "<title>" --body "<summary; Closes #<issue> if there is one>". Then run: ssi next.',
          refs: ref('implement'),
          requires: ['push', 'draft-pr'],
        };
      }
      return {
        kind: 'verify-implementation',
        headline: 'Run the full tests and record the result',
        instructions: 'Run the verification suited to this change: ssi check --phase 5 -- <command and arguments>. Use focused regression tests first; run the required project checks before completion. The engine stores the command, exit status, output and code snapshot.',
        refs: ref('implement'),
        requires: [],
      };
    case 'review': {
      const r = config.review;
      const codex = [`codex exec review --base ${safeToken(facts.base, 'main')}`, '-c \'sandbox_mode="read-only"\'', '-c \'approval_policy="never"\''];
      if (r.codexModel) codex.push(`-c 'model="${safeToken(r.codexModel, "")}"'`);
      if (r.codexEffort) codex.push(`-c 'model_reasoning_effort="${safeToken(r.codexEffort, "")}"'`);
      const codexHelp = r.reviewers.includes('codex')
        ? `For Codex check it first (codex --version, codex login status), then run it in the background: ${codex.join(' ')}. If it fails, treat it as missing and use the next reviewer. ` : '';
      return {
        kind: 'review',
        headline: 'Get an independent review',
        instructions: `Review in this order: ${r.reviewers.join(', ')}${r.parallel ? ' (parallel reviews only for distinct risks)' : ''}. ${codexHelp}Use fresh context and report the actual reviewer; same-model review is independent: no. Fix real blockers. Then run: ssi record --phase 6 --result pass|fail --evidence <report file> --note "<reviewer>; independent: yes|no".`,
        refs: ref('review'),
        requires: [],
      };
    }
    case 'visual':
      return {
        kind: 'capture-visual',
        headline: 'Check the changed screen or interaction',
        instructions: 'Capture a screenshot for static appearance or a short recording when motion matters. Run: ssi upload --file <artifact>. Include the link in the PR. Then run: ssi record --phase 7 --result pass|fail --evidence <artifact path> --note "<what was observed>".',
        refs: ref('visual'),
        requires: ['push'],
      };
    case 'land':
      return {
        kind: 'watch-ci',
        headline: 'Watch CI and fix failures',
        instructions: 'Run: ssi ci. It reads checks for the exact PR commit and records their real status. Pending checks mean wait; failed checks need a fix. No checks means unverified CI, explicitly reported.',
        refs: ref('land'),
        requires: [],
      };
    default:
      if (facts.dirty) {
        return {
          kind: 'commit-changes',
          headline: 'Commit or discard the leftover changes',
          instructions: 'Identify the uncommitted changes. Commit only the task changes, then re-check their proofs. Preserve unrelated user edits; explain any remaining limitation instead of discarding them. Then run: ssi next.',
          refs: ref('implement'),
          requires: [],
        };
      }
      if (facts.prUnknown) {
        return {
          kind: 'wait-for-github',
          headline: 'Finish once GitHub is reachable',
          instructions: 'GitHub is not reachable, so I cannot check or finalize the PR yet. Nothing is lost. Run: ssi next again when the connection is back.',
          refs: ref('land'),
          requires: [],
        };
      }
      const openItems = parseOpenItems(facts.pr?.body);
      if (openItems.length) {
        return {
          kind: 'close-open-items',
          headline: `Close the open items first (${openItems.length} left, next: ${openItems[0]})`,
          instructions: `The PR body still has ${openItems.length} unchecked item(s) under "Open items". Do the first one now: ${openItems[0]}. Then tick it in the PR body with proof (- [x] <what you did and how it was checked>), or, only if the user says so, write "- [x] waived by user: <reason>". Re-run the checks, commit and push if the code changed, then run: ssi next. The run is not done and the PR is not marked ready while any "- [ ]" remains.`,
          refs: ref('land'),
          requires: [],
        };
      }
      if (config.mandate.ready && facts.pr?.isDraft) {
        return {
          kind: 'mark-ready',
          headline: 'Mark the PR ready for review',
          instructions: `Run: gh pr ready ${facts.pr.number}`,
          refs: ref('land'),
          requires: ['ready'],
        };
      }
      return {
        kind: 'done',
        headline: 'The PR is ready for you',
        instructions: 'Give the user the PR link and say what was verified. Do not merge.',
        refs: ref('land'),
        requires: [],
      };
  }
}
