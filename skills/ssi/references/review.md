# Phase 6: Review

Goal: a second pair of eyes that did not write the code.

Order of reviewers (settings can change it):

1. **Codex CLI**: `codex exec review --base <base branch>`. Verified for the installed version; run it from the repository root.
2. A **sub-agent on a different model**.
3. A **fresh-context sub-agent** of the same model. Tell the user this review is not independent.

With `review.parallel` on, run several and merge the findings.

Triage the findings:
- **Blocking** (wrong behaviour, security, data loss, missing test for changed logic): fix, then record again.
- **Non-blocking**: list them in the PR description.
- A "simplification" that removes a protection or a test is not a simplification. Reject it.

Record: `ssi record --phase 6 --result pass|fail --evidence <report file> --note "<reviewer>; independent: yes|no"`.
`fail` sends you back to implement. After the configured number of failed rounds the engine stops and asks the user.
