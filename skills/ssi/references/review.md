# Review

Standard or risky work gets a fresh perspective. Small safe runs skip this phase.
Read the diff and necessary surrounding code once. Check behavior, compatibility, missing regression coverage
and avoidable complexity. A different model alone does not establish independence.

## Reviewer

Use the configured reviewer order. Default: usable Codex CLI, else a sub-agent on another model,
else a fresh-context helper of the same model. Report the actual setup; same-model review uses independent: no.
Avoid several reviewers unless separate risks justify their cost.

For Codex, check `codex --version` and `codex login status`, then run from the repository root:
`codex exec review --base <base> -c 'sandbox_mode="read-only"' -c 'approval_policy="never"'`.
Save the output. Use the user's installed configuration; do not guess model names. Optional
review.codexModel and review.codexEffort settings pin the model. A failed or unsupported invocation is
not a review: explain the reason and try the next configured reviewer without repeated guessing.

## Report

Write JSON:
```json
{"verdict":"approve","summary":"What was reviewed and its limits","findings":[],"next_steps":[]}
```
Findings use severity (critical, high, medium, low), title, body, file, line_start, line_end, confidence and recommendation.
Use needs-attention when blockers remain; the engine refuses an approving pass with critical/high findings.
Validate findings against code before fixing them. Correct real defects with appropriate checks; reject
incorrect feedback with evidence. Nonblocking follow-ups can stay in the handoff or an authorized Issue.

Before approval, remove or justify unused helpers, speculative options, redundant abstractions and dependencies.
Preserve meaningful protections and tests. Judge simplicity by what a human must understand to review the behavior.

`ssi record --phase 6 --result pass|fail --evidence <report.json> --note "<reviewer>; independent: yes|no"`.
A failure saves the report and returns to implementation; the retry budget limits repeated rounds.
The engine checks the artifact and verdict, not the reviewer's identity or the truth of every finding.
