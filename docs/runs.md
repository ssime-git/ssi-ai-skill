# Run history and evidence

## Current validation (2026-10-25)

SSI 0.3.0 was validated with 158 engine/package tests, 9 Python evaluation tests, workflow replay,
package inspection and real Codex/Claude smoke tests. The [routing report](routing-evaluation.md)
records four direct implementations, sixteen routing decisions and two completed tracked answer workflows.
The [historical model comparison](model-evaluation.md) predates the final router and must not be used
as a paired estimate of its token savings. Synthetic GitHub checks do not establish live remote behavior.

## Local engine self-use (2026-10-25)

Repository: ssime-git/ssi-ai-skill, baseline 4f486cf. Work was performed on the local branch
improve/adaptive-efficient-workflows. No Issue, PR, merge or deployment was required for the self-use run.
The substantial authorized change uses a standard local route; its diff-size limits were raised only in
ignored .ssi/config.local.json for this run, rather than changing the shipped defaults.

The engine recorded the actual brief, confirmed defects and short plan, then executed its own test suite
with check. A fresh-context reviewer on the same model found three defects: pre-fix evidence became stale
after fixing the bug, tracked local edits were missed without a conventional base branch, and model gates
were skipped when source changed without a manifest edit. All three were corrected, covered by regression
tests and re-reviewed with an approving verdict and no remaining blocking findings. This is fresh-context
review, not a different-model review.

The suite passed 158 tests under Node 26.8.1 with test isolation disabled for a complete individual test count.
The structure validator and whitespace checks also passed. This local run does not claim execution on the
Node 20/22 CI matrix or a live GitHub CI integration; those paths use the stubbed GitHub interface in tests.
Self-use receipts and review artifacts live in ignored .ssi/. Aggregate reproducible measurements and their
limits are retained in [efficiency.md](efficiency.md) and [efficiency.json](efficiency.json).

## Archived pre-0.3 runs (2026-10-03)

The disposable repository used here was deleted on 2026-10-04, so the pull request numbers below no longer resolve.

Disposable private repository `ssime-git/ssi-sandbox`, real `gh`, real GitHub Actions CI, driven by following `skills/ssi/SKILL.md`. Reviews were done by sub-agents because Codex could not run on this account (see below).

| Run | Kind | Result | Pull request |
|---|---|---|---|
| 1 | Logic bug (discount maths) | Done: repro test, Issue (created once, second call deduped), draft PR, state comment, review, CI green, stays draft | #2 |
| 2 | Visual bug (invisible button label) | Done: headless Chrome before/after screenshots, GIF built with ffmpeg, uploaded to `ssi-assets`, linked in the PR, CI green | #5 |
| 3 | Feature (shipping fee), reuse `total()` | Done: reproduce skipped, `create-branch` on main, review, new commit made earlier proof stale, re-review, CI green | #7 |

### Exercised for real

- Issue creation and dedupe by key, draft PR, PR state comment sync, CI watch, "stay draft" mandate.
- Heal: local notes deleted, restored from the PR comment (run 1).
- Stale proof: a commit inside the declared surface sent the run back to implement (run 3).
- `create-branch` on the base branch, `push-changes` before a re-review, a new run started after a finished one without `--force`.
- Assets branch: first upload created the orphan `ssi-assets` branch and pushed it; main untouched.
- Review fallback: Codex refused; sub-agents of other models reviewed; the reviewer and its independence were recorded in the PR.

### Found by the runs and fixed

- After a push, `gh pr list` reports the old PR head for a few seconds, so the engine asked to push again. Fixed: our own remote-tracking ref counts as pushed.

### Historical review environment

At the time of these archived runs, the tested Codex CLIs were unavailable to the account, so fresh subagents
provided reviews. This is historical context, not the current compatibility status: later Codex and Claude
trials are documented above. The older temporary repository and its PRs are no longer available.

### Found by the author reading the PR

- The first link format (`raw.githubusercontent.com/...`) does not render in a private repository: the "Proof" section of PR #5 was empty. Changed to `github.com/<owner>/<repo>/blob/ssi-assets/<path>?raw=true`; the author confirmed the GIF then shows.

### Not exercised

- `STOP_VISUAL`, `STOP_CI` and a failing CI run: covered by engine tests only.
- `ssi purge` against closed PRs, Windows paths, forks.
- The cockpit mod inside a live session (validated with `claude plugin validate` only).
