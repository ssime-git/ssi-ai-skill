const ref = (n) => [`references/${n}.md`];

export function actionFor({ name, state, facts, config }) {
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
        instructions: 'Search for code to reuse first, then write the smallest plan that works. Put structure ideas in a follow-up issue. Then run: ssi record --phase 4 --result pass --evidence <plan file> --touches <comma-separated files> [--public-api].',
        refs: ref('plan'),
        requires: [],
      };
    case 'implement':
      if (facts.commitsAhead === 0) {
        return {
          kind: 'implement',
          headline: 'Write the failing test first, then the code',
          instructions: `If you are on ${facts.base ?? 'the base branch'}, create the branch ssi/<short-name>. Write the failing test, make it pass, commit in small steps. Then run: ssi next.`,
          refs: ref('implement'),
          requires: [],
        };
      }
      if (!facts.pr) {
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
        instructions: 'Run the full test suite. Then run: ssi record --phase 5 --result pass|fail --evidence <test output file> --surface <comma-separated directories you changed>.',
        refs: ref('implement'),
        requires: [],
      };
    case 'review':
      return {
        kind: 'review',
        headline: 'Get an independent review',
        instructions: `Review with an independent reviewer, in this order: ${config.review.reviewers.join(', ')}${config.review.parallel ? ' (run them in parallel and merge the findings)' : ''}. For Codex run: codex exec review --base ${facts.base ?? 'main'}. If Codex is missing, use a sub-agent on another model, else a fresh-context sub-agent. Say which reviewer really ran and whether it was independent. Fix blockers. Then run: ssi record --phase 6 --result pass|fail --evidence <report file> --note "<reviewer>; independent: yes|no".`,
        refs: ref('review'),
        requires: [],
      };
    case 'visual':
      return {
        kind: 'capture-visual',
        headline: 'Record a short GIF of the change working',
        instructions: 'Capture a short GIF with a headless browser. Run: ssi upload --file <gif>. Paste the printed Markdown into the PR body. Then run: ssi record --phase 7 --result pass|fail --evidence <gif path>.',
        refs: ref('visual'),
        requires: ['push'],
      };
    case 'land':
      return {
        kind: 'watch-ci',
        headline: 'Watch CI and fix failures',
        instructions: `${config.ci.watch ? 'Watch the checks: gh pr checks --watch. ' : ''}If they fail, read the logs and run: ssi record --phase 8 --result fail (this sends you back to implement). If they are green, run: ssi record --phase 8 --result pass.`,
        refs: ref('land'),
        requires: [],
      };
    default:
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
