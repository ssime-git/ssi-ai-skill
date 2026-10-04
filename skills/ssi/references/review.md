# Phase 6: Review

Goal: a second pair of eyes that did not write the code.

## Order of reviewers (settings can change it)

1. **Codex CLI**, native review. Same approach as OpenAI's `codex-plugin-cc`: use the installed `codex` binary and your own Codex config, read-only, no approvals.
2. A **sub-agent on a different model**.
3. A **fresh-context sub-agent** of the same model. Tell the user this review is not independent.

With `review.parallel` on, run several and merge the findings.

## Running Codex

1. Check it is usable: `codex --version` and `codex login status`. If either fails, Codex is missing: go to the next reviewer and say why.
2. Run it in the background (a multi-file review takes a while), from the repository root, and save the output to a file:
   `codex exec review --base <base> -c 'sandbox_mode="read-only"' -c 'approval_policy="never"'`
3. No model is forced: Codex uses your `~/.codex/config.toml`. To pin one, set `review.codexModel` and `review.codexEffort` in `ssi.config.json` or `.ssi/config.local.json`; the engine adds `-c 'model="…"'`.
4. A run that exits non-zero, or whose output contains `ERROR` (for example "The 'X' model is not supported when using Codex with a ChatGPT account"), did **not** review anything. Treat Codex as missing, tell the user the reason, and use the next reviewer. Do not guess other model names and do not retry in a loop.

## The report

Whatever the reviewer, write one report with this shape (it is the schema OpenAI's plugin uses for structured reviews):

```json
{ "verdict": "approve | needs-attention", "summary": "…",
  "findings": [{ "severity": "critical|high|medium|low", "title": "…", "body": "…",
                 "file": "path", "line_start": 1, "line_end": 1,
                 "confidence": 0.0, "recommendation": "…" }],
  "next_steps": ["…"] }
```

## Triage

- **Blocking** (wrong behaviour, security, data loss, missing test for changed logic; severity critical or high with real confidence): fix, commit, push, then record again.
- **Non-blocking**: list them in the PR description and open one follow-up Issue.
- A "simplification" that removes a protection or a test is not a simplification. Reject it.

Record: `ssi record --phase 6 --result pass|fail --evidence <report file> --note "<reviewer>; independent: yes|no"`.
When you record a `fail`, always pass `--evidence <report file>` and `--note "<what to fix>"`: the engine keeps them, so a fix that is interrupted can be resumed.
`fail` sends you back to implement. After the configured number of failed rounds the engine stops and asks the user.
