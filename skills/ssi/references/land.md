# Phase 8: Land

1. `gh pr checks --watch`.
2. Red: read the failing log, find the cause, record `ssi record --phase 8 --result fail --evidence <log file> --note "<cause>"`. That sends you back to implement. The engine stops after the configured number of failed CI rounds.
3. Green: `ssi record --phase 8 --result pass --note "checks green"`. If the repo has no CI at all, say so with `--note "no CI configured"`. The engine refuses a pass without a note, and the report must say nothing was checked automatically.
4. With `ci.reviewComments` on, also read human review comments: apply the clear ones, answer or ask about unclear ones, and never resolve a thread for someone else.
5. The PR stays a draft unless `mandate.ready` is true; then the engine will ask you to run `gh pr ready`.

Never merge. Say plainly what was verified and what was not.

Housekeeping: `ssi purge` removes the GIFs of closed PRs from `ssi-assets`.

Done means proven: do not say "fixed", "passing" or "ready" from memory. Run the command in this turn and quote its result.

Before landing, read the PR body "Open items". Any `- [ ]` left means you are not done: go back to the earliest open item, close it, and re-run the checks. Do not report completion, or mark the PR ready, while one remains unless the user waived it.
