# Phase 6: Review

Goal: a second pair of eyes that did not write the code.

Order of reviewers (settings can change it):

1. **Codex CLI**: `codex exec review --base <base branch>`, from the repository root. The command exists in codex-cli 0.154, but it fails when the configured model is not allowed for the account (seen: "model is not supported when using Codex with a ChatGPT account"). If Codex is installed but fails for any reason (model, login, network), treat it as missing and say why. Do not guess another model name.
2. A **sub-agent on a different model**.
3. A **fresh-context sub-agent** of the same model. Tell the user this review is not independent.

With `review.parallel` on, run several and merge the findings.

Triage the findings:
- **Blocking** (wrong behaviour, security, data loss, missing test for changed logic): fix, then record again.
- **Non-blocking**: list them in the PR description.
- A "simplification" that removes a protection or a test is not a simplification. Reject it.

Record: `ssi record --phase 6 --result pass|fail --evidence <report file> --note "<reviewer>; independent: yes|no"`.
`fail` sends you back to implement. After the configured number of failed rounds the engine stops and asks the user.
