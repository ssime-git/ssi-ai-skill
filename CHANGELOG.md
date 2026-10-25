# Changelog

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
