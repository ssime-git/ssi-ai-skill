# SSI design reference

The shared Codex/Claude Code entrypoint first decides whether tracking is useful.
Clear, confined, low-risk tasks use normal agent tools without SSI state or phase guides.
Missing requirements get a targeted clarification, not automatic escalation.
Substantial or risky work loads references/workflow.md and chooses a destination.
An explicit SSI invocation still permits direct work; an active tracked task resumes without bypassing stops.
Escalation reuses observations and artifacts, while executed receipts still require actual execution.

The model chooses an appropriate destination and investigates the task. A dependency-free Node engine
tracks progress, executes checks, invalidates stale verification and enforces operational stops.
The engine does not decide whether the code, a test expectation or a visual result is semantically correct.

## Routes

A run stores workflow.target (answer, local, pr), scope (small, standard) and issue policy.
Defaults are local, standard and optional. These choices survive resumption and PR state synchronization.
Old v0.2 states without workflow retain the original PR destination and required-Issue policy.
Both simple explanations and simple implementations can finish without an engine run.
The small engine scope is available when explicit tracking is useful even for a small task.

Answer runs use analyze and confirm. Local changes omit remote landing. Small, safe changes skip a separate
plan and review, and non-bugs also skip confirm. Bugs always retain confirmation and reproduction.
The small route is withdrawn when the actual diff exceeds 80 changed lines or 3 files, touches a protected
or risk-related path, or declares a public interface change. These are conservative routing heuristics,
not measured universal safety thresholds. Standard runs retain a short plan and a fresh review.
Visual verification applies to UI changes; artifacts may be screenshots or recordings.

## Running the tracked engine

These commands are for work that has already selected tracking, not a prerequisite for a small edit.
Run from the repository being changed and resolve the script from the installed skill folder:

```bash
node /path/to/ssi/scripts/ssi.mjs start "Investigate failing checkout" --target answer
node /path/to/ssi/scripts/ssi.mjs next --compact
node /path/to/ssi/scripts/ssi.mjs check --phase 2 --expect-exit 1 -- npm test
# For implementation verification: check --phase 5 -- npm test
# Only when requested: start "..." --target pr
```

The next action names the relevant guide. Read it once, perform the action, save real evidence and continue.
State and receipts belong in ignored .ssi/. Use the actual user's answer for a stop; never manufacture approval.
Read effective settings with config; repository settings are in ssi.config.json and personal overrides
in .ssi/config.local.json. The optional cockpit displays tracked state, not direct tasks.

## Upgrading from 0.2

Replace the entire installed skills/ssi folder so the new workflow guide and engine remain together.
New runs default to local work; old states keep their original PR/required-Issue policy.
Existing permissive free-text evidence is not a replacement for a real receipt: record actual artifacts,
execute checks and inspect CI as requested by the current next action. Keep existing .ssi state when resuming.
The new entrypoint does not erase instructions already loaded into an agent conversation.

## Evidence

Manual record requires an existing nonempty artifact. It stores a digest and labels it reported.
A passing review requires JSON with an approving verdict, summary and no critical/high findings.
Neither the JSON verdict nor the reviewer's identity is independently authenticated by the engine.

check executes an argument array directly and stores the command, actual exit code, output and snapshot.
Unexpected failures invalidate the phase and dependent work; expected reproduction failures must run normally.
Phase 5 passes only through check. Local snapshots include tracked modifications and untracked nonignored files.
A changed snapshot invalidates verification, even without a new commit. PR proof requires committed code.
Multiple checks on one snapshot are retained; ignored files, dependencies, services and other external inputs
are outside the snapshot. Recheck when those inputs change. Never describe the cache as an absolute correctness guarantee.

ci reads the open PR's check rollup and requires its head to match the local commit.
Pending, failed and absent checks are distinct. Absence is explicitly recorded as CI unverified.
A note saying checks green cannot substitute for this read. A local target never needs CI publication checks.

## State, side effects and boundaries

next --compact returns the next instruction without duplicate presentation fields. References load once per relevant phase.
Local and answer runs do not query GitHub, except to retry an Issue creation explicitly requested earlier.
PR runs retain remote progress recovery, authenticated-comment filtering and exact run identifiers.
Lost PR state requires next --target pr or repository workflow.target=pr; default local runs never probe GitHub.
Issues are optional. --follow-up separates deferred work from the current bug; stable keys deduplicate retries.
Never merge, close Issues or deploy. Creation of a local run does not expand user authorization.

Guards apply to changed risk paths, rather than every tool present in the repository. Their exit statuses
prove execution, not semantic coverage. Local waiver metadata records authorization; it cannot authenticate a human.
Retry budgets and branch/history checks remain enforced. Required Open items prevent PR completion.

## Validation

Engine tests use disposable Git repositories, local processes and a stubbed GitHub interface.
Real local self-use is documented in runs.md. An engine-output byte benchmark estimates prompt overhead;
it does not measure model tokens, code quality or total task cost. Compare actual model sessions before
claiming a general efficiency gain. See philosophy.md for the design rationale.
