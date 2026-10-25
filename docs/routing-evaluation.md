# Direct and tracked routing: Codex and Claude Code

SSI now has a shared 1,692-byte entrypoint, down from 3,528 bytes (52.0% less UTF-8 text).
This is an instruction-size reduction, not a measured task-token saving.
The tracked instructions live in references/workflow.md and load only when useful.
A tracked task loads both files, so this change is intended to avoid unnecessary workflow overhead
on simple tasks; it does not establish a saving on substantial tasks.

## Observed behavior

Real authenticated CLI runs on 2026-10-25, one repetition per cell:

| Host | Task | Held-out assertions | SSI artifacts | Seconds | Reported total tokens |
| --- | --- | --- | --- | --- | --- |
| Codex 0.163.0 | Add mean using sum | 7/7 | None | 29.520 | 102,259 |
| Codex 0.163.0 | Fix percentage discount | 8/8 | None | 35.731 | 141,252 |
| Claude Code 2.1.287 | Add mean using sum | 7/7 | None | 27.945 | 64,804 |
| Claude Code 2.1.287 | Fix percentage discount | 8/8 | None | 38.008 | 157,197 |

Visible tests were also independently executed and passed. Both bug trials added regression tests
and demonstrated failure before the fix. In these four direct trials, no Issues, PRs, tracked runs or external services were created.
Codex used gpt-6.1-sol with medium reasoning. Claude used its existing default claude-opus-5-5.
These models and provider usage conventions differ; do not treat this as a comparison between hosts.
Codex total is input plus output, with cache reads already included in input.
Claude total adds input, output, cache reads and cache creation because those fields are disjoint.

Claude loaded the project-local skill through native `/ssi` invocation; its initialization event
listed `ssi` among available skills and commands. Codex explicitly read the installed skill from its
fixture instructions, with unrelated host skill discovery disabled for isolation.
Neither host had a preset SSI scope or destination. The agents selected direct execution themselves.

A separate decision-only batch passed 8/8 cases on each host: typo, confined bug, unclear goal,
one-line authorization change, coupled migration, interrupted tracked work, explicit tracking request,
and newly discovered broader scope. Unclear goals received clarification; risky or explicitly tracked
work selected tracking. These are routing decisions, not executed migrations or proof of tracked completion.

## Final tracked-work checks

The remaining compatibility check was completed on both hosts: explain the existing sum implementation
with saved SSI progress, source inspection and an executed behavior probe. No target or scope was preset.

| Host | Engine target | Engine completion | Source/test changes | GitHub calls | Seconds | Reported total tokens |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | answer | done | None | 0 | 61.722 | 208,592 |
| Claude Code | answer | done | None | 0 | 63.392 | 232,990 |

Both hosts loaded the tracked guide, saved analysis and confirmation evidence, and reached done.
The confirmation guide now explicitly covers investigations: verifying a claim does not require
inventing a missing feature. The probes and evidence are retained locally with raw CLI events.

This checks workflow execution and preservation of scope, not perfect natural-language accuracy.
Manual inspection found overgeneralizations in Claude's answer: the function also accepts a custom
object with a callable reduce, and some invalid element types throw rather than failing silently.
Its detailed table correctly showed the BigInt exception. These are answer-quality limitations,
not failures of the engine-completion assertion; no claim of perfect precision follows from this test.

The final local check ran 158 engine/package tests and 9 Python evaluation tests, all passing.
Skill validation, package validation, diff checking, all three workflow replays and an npm package dry run passed.
The package has 40 files, includes the conditional workflow guide and scripts, and excludes private trial artifacts.
Local checks used Node 26.8.1 and Python 3.14.7; the declared Node 20/22 CI matrix was not run locally.

Final records: [evaluations/results/2026-10-25-final](../evaluations/results/2026-10-25-final/).

## Validation and limits

The engine's 158 tests passed; package validation, nine Python evaluation tests and workflow replay passed.
The replay counts the newly conditional workflow guide whenever it explicitly starts the engine.
Three initial Claude launcher attempts failed before reaching the model because a variadic CLI option
consumed the prompt. The harness now uses an explicit `--` separator; the failed attempts are retained
as infrastructure failures with unknown usage, not zero-token successful trials.

This is a small behavioral smoke test. It does not establish automatic skill-discovery recall,
production quality, end-to-end reviewed implementation/PR execution through Claude, or statistically reliable token savings.
The routing batch exposes the entrypoint directly and tests decisions rather than tool use.
There is no contemporaneous, randomized plain-agent control in this run; the previous model evaluation
used different prompts and conditions. Its numbers must not be reused as a paired baseline here.

The entrypoint is guidance interpreted by each agent, not a deterministic classifier or an unload API.
Previously read instructions remain in conversation context. New independent tasks can use direct work;
an active tracked task retains its stops and evidence requirements.

Reproduction: evaluations/run_routing_eval.py. Inspectable trial records, manifests and launcher failures:
[evaluations/results/2026-10-25-routing](../evaluations/results/2026-10-25-routing/).
Raw events and final fixture copies are retained locally under ignored raw/ and artifacts/ directories.
