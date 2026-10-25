# Implement

Read the affected code and callers. Make the smallest change that satisfies the request.
Use explicit names and existing patterns; add abstractions only when they simplify real usage.
A reviewer should understand why the change exists, what it does and how it was verified.

For a bug, make the reproduction fail before the fix and pass afterwards; retain it as a regression test.
For other work, select checks that can detect a real failure. A static text edit need not gain a unit test.
Measure performance work before and after under comparable conditions.

Local route: preserve unrelated edits; no commit or remote operation is needed.
PR route: create a working branch before editing the base branch, commit, push and open a draft PR.
Do not include unrelated work. Never push the base branch. Preserve the project's own contribution rules.

Run `ssi check --phase 5 -- <command> [args]`. It executes directly, without shell expansion.
Use a project script or `sh -c '<command>'` only when a shell is genuinely needed.
For PRs, commit code first. Checks must not modify the tested tree. Receipts live in ignored `.ssi/evidence/`.
Multiple checks on the same snapshot are retained. Start with focused checks, then complete required project checks.
Do not repeat an unchanged successful check without a reason such as a flaky environment or changed inputs.

After a failed review or check, inspect the saved failure report, fix the cause, then verify again.
Stop repeated guessing; ask for missing information when the retry budget is exhausted.
