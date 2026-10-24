# AGENTS.md — SSI loop for Codex

Copy this file to the root of the repository you want Codex to work in (or append it to your existing `AGENTS.md`). Codex reads `AGENTS.md` from the git root down to the working directory; keep the combined file under 32 KiB (`project_doc_max_bytes`).

Replace `<SSI>` with the path of `ssi.mjs`
(for example `node_modules/ssi-ai-skill/skills/ssi/scripts/ssi.mjs`). Requires Node >= 20.

## SSI engineering loop

For any request to fix a bug or build a change that should end as a reviewed draft PR:

1. New request: `node "<SSI>" start "<the user's request, in their words>"`. Resuming: skip.
2. Run `node "<SSI>" next`. It prints JSON: read `action`, `stop`, `say`, `warnings`.
3. If `stop` is set: ask the user its `question` with its `options` and your recommended default, then run `node "<SSI>" answer "<letter> <their words>"`. Never pass free text without the option letter.
4. Otherwise do `action.instructions`; read the guide in `action.refs` first (under `skills/ssi/references/`).
5. Report with the `ssi record ...` command the action gave you, then go to step 2.
6. Stop when `done` is true. Give the PR link and what was verified.

Rules:
- Never decide the phase, a threshold or a stop yourself: the engine decides.
- Before landing, run `node "<SSI>" guards`. Exit code 1 means a production-risk contract (migration, infra, model promotion, LLM eval) is not proven. Do not bypass it; waivers need a human author and a reason (see `references/guards.md`).
- Never merge, publish, or push to the default branch. Draft PR only; a human lands it.
- Keep messages short: where we are, what happened, what is next, and at most one question.

## How to talk to me

Talk like a thoughtful colleague, not a manual. Technical words are fine, but explain each one in a simple sentence the first time. Short, friendly, concrete. Answer in the language I write in.
