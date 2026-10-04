# Phase 8: Land

1. `gh pr checks --watch`.
2. Red: read the failing log, find the cause, record `ssi record --phase 8 --result fail --evidence <log file> --note "<cause>"`. That sends you back to implement. The engine stops after the configured number of failed CI rounds.
3. Green: `ssi record --phase 8 --result pass`.
4. With `ci.reviewComments` on, also read human review comments: apply the clear ones, answer or ask about unclear ones, and never resolve a thread for someone else.
5. The PR stays a draft unless `mandate.ready` is true; then the engine will ask you to run `gh pr ready`.

Never merge. Say plainly what was verified and what was not.

Housekeeping: `ssi purge` removes the GIFs of closed PRs from `ssi-assets`.
