# Reproduce a bug

Build the smallest artifact that fails for the reported reason: a unit test, request, CLI command or browser script.
Use the existing environment; do not introduce containers unless the bug actually requires them.
For intermittent failures, record the conditions and observed frequency instead of claiming certainty.

Run the artifact and inspect its failure. `ssi check --phase 3 --expect-exit 1 -- <command>` records an
expected failure directly. A missing command, signal or timeout never counts as a successful reproduction.
For visual or other manually inspected symptoms, record an existing artifact and explain what it shows.
After the fix, keep a regression test appropriate to the behavior.

No Issue is required by default. Create one for important tracking or the project's contribution rules,
within authorization. A repository can explicitly require one with workflow.issues = "required".
For optional out-of-scope work, use `ssi issue create --follow-up --title "..." --body "<evidence, impact, next step>"`.
Follow-ups have separate deduplication keys and never become the current bug's closing reference.
