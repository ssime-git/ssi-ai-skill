# SSI v2: real runs (2026-10-03)

The disposable repository used here was deleted on 2026-10-04, so the pull request numbers below no longer resolve.

Disposable private repository `ssime-git/ssi-sandbox`, real `gh`, real GitHub Actions CI, driven by following `skills/ssi/SKILL.md`. Reviews were done by sub-agents because Codex could not run on this account (see below).

| Run | Kind | Result | Pull request |
|---|---|---|---|
| 1 | Logic bug (discount maths) | Done: repro test, Issue (created once, second call deduped), draft PR, state comment, review, CI green, stays draft | #2 |
| 2 | Visual bug (invisible button label) | Done: headless Chrome before/after screenshots, GIF built with ffmpeg, uploaded to `ssi-assets`, linked in the PR, CI green | #5 |
| 3 | Feature (shipping fee), reuse `total()` | Done: reproduce skipped, `create-branch` on main, review, new commit made earlier proof stale, re-review, CI green | #7 |

## Exercised for real

- Issue creation and dedupe by key, draft PR, PR state comment sync, CI watch, "stay draft" mandate.
- Heal: local notes deleted, restored from the PR comment (run 1).
- Stale proof: a commit inside the declared surface sent the run back to implement (run 3).
- `create-branch` on the base branch, `push-changes` before a re-review, a new run started after a finished one without `--force`.
- Assets branch: first upload created the orphan `ssi-assets` branch and pushed it; main untouched.
- Review fallback: Codex refused; sub-agents of other models reviewed; the reviewer and its independence were recorded in the PR.

## Found by the runs and fixed

- After a push, `gh pr list` reports the old PR head for a few seconds, so the engine asked to push again. Fixed: our own remote-tracking ref counts as pushed.

## Found by the independent review of the engine and fixed (before the runs 2 and 3)

They are summarised in [philosophy.md](philosophy.md#what-review-taught-us); the code is the reference.

## Codex

Every model tried is refused by this ChatGPT account, including the configured default and `gpt-5.5-terra`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex-spark`, with codex-cli 0.154 and 0.133. `codex doctor` reports 0.160 available; it was not installed. The call now follows `openai/codex-plugin-cc` (preflight, read-only, optional model in config, failure treated as missing, structured report).

## Found by the author reading the PR

- The first link format (`raw.githubusercontent.com/...`) does not render in a private repository: the "Proof" section of PR #5 was empty. Changed to `github.com/<owner>/<repo>/blob/ssi-assets/<path>?raw=true`; the author confirmed the GIF then shows.

## Not exercised

- `STOP_VISUAL`, `STOP_CI` and a failing CI run: covered by engine tests only.
- `ssi purge` against closed PRs, Windows paths, forks.
- The cockpit mod inside a live session (validated with `claude plugin validate` only).
