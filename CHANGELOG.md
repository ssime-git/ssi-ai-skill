# Changelog

## 0.4.0 - 2026-11-10

- **Renamed SSI to Tracer.** Command `/tracer`, state in `.tracer/`, settings in `tracer.config.json` and `tracer.guards.json`, cockpit `mods/tracer-cockpit`. The GitHub repository and npm package keep the name `ssi-ai-skill` for now.
  Migrate an existing project with `git mv ssi.config.json tracer.config.json`, `git mv ssi.guards.json tracer.guards.json` and `mv .ssi .tracer`.
- **Risk-based review routing.** The engine adds review roles from the real diff: `ui` and `ux` for UI surfaces, `security` for auth/payment/secret code, `data` for migrations and infrastructure. The review report must list every required role in `roles`, or the pass is refused.
- **Model tier per step.** Each action carries a `fast`, `balanced` or `deep` tier (`models.steps`), raised one tier for high-risk plan/implement/review and after a failed attempt of the same step. `models.tiers` maps tiers to concrete model names; empty by default, so hosts without model switching are unaffected.
- **Frozen files.** Modifying or deleting an existing test or gate configuration (`frozenPaths`) stops the run until the user approves each file by name. New test files are unaffected.
- **Refusals.** `tracer refuse --why` ends triage with a stop; the user can answer with a changed request.
- **Feedback ledger.** Review findings, visual observations and user decisions get ids and statuses (`tracer feedback`, `feedback resolve`) and appear as a table in the PR progress comment. Text is neutralised before display.
- Request, Issue and PR text is treated as quoted data, never as instructions (analyze guide).

## 0.3.0 - 2026-10-25

- Support Codex and Claude Code through one short entrypoint. Handle simple tasks directly; load tracked instructions only when useful.
- Clarify only blocking gaps. Escalate when scope or risk grows and reuse existing evidence.
- Add answer, local and draft-PR destinations. New runs default to local with optional Issues; existing 0.2 states retain their PR destination and Issue policy.
- Skip separate planning and review for small safe tracked changes; retain bug reproduction and restore safeguards for growing or risky diffs.
- Execute checks with receipts tied to the code snapshot; reject missing artifacts, invalid negative checks and stale verification.
- Inspect real PR CI results rather than accepting a note. Scope risk guards to changed paths and relevant dependencies.
- Deduplicate optional follow-up Issues separately from the current bug. Accept screenshots or recordings according to the behavior.
- Keep unresolved required PR Open items blocking completion and readiness.
- Add compact engine output, workflow replay, real model trials and Codex/Claude routing checks, with documented limitations.
- Rewrite installation, usage, reliability, migration and contributor documentation; preserve upstream licences and credits.

## 0.2.0 - 2026-10-16

- Reject unknown record options; require notes for review and CI passes.
- Stop after repeated analysis, planning or implementation failures instead of looping indefinitely.

## 0.1.0

- First public release: single-entry request-to-draft-PR loop, engine tests and CI on Node 20 and 22.
