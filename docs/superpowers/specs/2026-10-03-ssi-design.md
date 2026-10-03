# SSI v2 — one-entry engineering loop that lands a PR

Status: draft for review · Date: 2026-10-03 · Language of the product: English

## 1. Intent

One skill, one entry point (`/ssi <request>`). It takes a request from "maybe unclear" to a PR that is ready for a human, by moving through eight phases on its own, remembering the next step, and repairing itself when reality and its notes disagree.

Success = a user invokes `/ssi`, walks away, and returns to a draft PR with green CI, a review report and (for UI work) a GIF, or to one clear question explaining why it stopped.

Reader-friendly by design: the author has ADHD. Output leads with the next action, stays short, shows progress, and avoids jargon (see section 7).

Assumptions confirmed during brainstorming: the current `ssi` is unpublished and may be rewritten freely; solo-first, but usable by English-speaking teams; v1 targets Claude Code.

## 2. Decisions (from the Q&A)

| # | Topic | Decision |
|---|---|---|
| 1 | Autonomy | Adaptive: autonomous by default, stops when uncertainty crosses a threshold |
| 2 | Forced stops | unclear request (a), no repro (b), protected interface (c), review failure after N rounds (e), out-of-mandate action (g). Thresholds configurable for big diff (d) and visual retries (f) |
| 3 | State | Local file is a cache; truth is rebuilt from git + PR + Issue. PR opens as draft early |
| 4 | Mandate | Invoking the skill allows push, draft PR, Issue, comments on this repo. Config can restrict or widen. Merge, close-issue, deploy are never allowed |
| 5 | Review | Codex CLI, else sub-agent on another model, else fresh-context sub-agent. Report states which reviewer ran and whether it was independent. Parallel reviewers by config |
| 6 | Visual proof | GIF committed to orphan branch `ssi-assets`, linked from the PR. Assets of closed PRs are purged |
| 7 | Repro | Method chosen by bug type; the artifact must be replayable. Container isolation only if the project already has one or it is needed |
| 8 | Plan | Reuse first (ponytail lens). Structure improvements go to a follow-up Issue, entering the PR only if blocking or net-negative in lines, as a separate commit |
| 9 | After PR | Watch CI and repair (2 tries). Handling human review comments is opt-in |
| 10 | Clients | Claude Code first; deterministic Node engine, thin skill, per-client adapter later |
| 11 | Architecture | "Next action" engine: `ssi next` returns the next verifiable action; the model does the work and calls it again |
| 12 | Style | `ui.style`: `guided` (default), `adhd` (opt-in), `plain` |

## 3. Architecture

```
user ──/ssi──▶ SKILL.md (thin)
                 │  loop:
                 ▼
          scripts/ssi.mjs next ──▶ {phase, action, stop?, reason, say}
                 ▲                         │
                 └──── model executes ◀────┘   (code, tests, gh, review)
```

- The engine is deterministic Node, no dependencies. It reads git, `gh` output, `.ssi/state.json`, and config; it writes only `.ssi/` and its own remote markers.
- The model never decides the phase, the thresholds or the stops. It executes the returned `action` with the client's tools, then calls `ssi next` again.
- Each phase has a short reference file loaded only when that phase is active.

### Engine output contract

```json
{
  "phase": 5,
  "name": "implement",
  "action": { "kind": "implement", "instructions": "…", "refs": ["references/implement.md"] },
  "stop": null,
  "say": { "where": "▓▓▓▓▓░░░ 5/8 Implement", "next": "write the failing test first", "eta": "~6 min", "needs_user": false },
  "warnings": []
}
```

When stopped: `"stop": { "code": "STOP_PROTECTED", "because": "…", "question": "…", "options": ["A …","B …"], "default": "A" }`.

Stop codes: `STOP_UNCLEAR`, `STOP_NO_REPRO`, `STOP_PROTECTED`, `STOP_BIG_DIFF`, `STOP_REVIEW`, `STOP_VISUAL`, `STOP_CI`, `STOP_OUT_OF_MANDATE`, `STOP_REALITY` (branch deleted, PR closed, force-push).

## 4. Phases

| # | Phase | Exit evidence | On failure |
|---|---|---|---|
| 1 | Analyze | Brief: goal, observable success criterion, listed gaps | blocking gap → `STOP_UNCLEAR` |
| 2 | Confirm | Missing piece or bug established by a fact (code, log, failing test) | not confirmed → back to 1 |
| 3 | Reproduce | Replayable artifact (test, script or capture). Skipped when not a bug. Opens the Issue | N attempts fail → `STOP_NO_REPRO` |
| 4 | Plan | Short plan: reuse list, touched interfaces, refactor proposals kept separate | touches protected path/public export → `STOP_PROTECTED` |
| 5 | Implement | Tests green, branch pushed, **draft PR open** | failures loop within budget; diff over threshold → `STOP_BIG_DIFF` |
| 6 | Review | Triaged findings, blockers fixed | rounds exhausted → `STOP_REVIEW` |
| 7 | Visual | GIF on `ssi-assets` linked in PR. Skipped when no UI surface | retries exhausted → `STOP_VISUAL` |
| 8 | Land | CI green; PR set ready only if config allows. Never merge | CI retries exhausted → `STOP_CI` |

Back-edges: review, visual or CI failure → phase 5. Evidence tied to an older SHA whose surface changed is marked stale and replayed.

Reproduction by bug type: pure logic → failing test; API → replayable request; visual → headless browser (Playwright) capture; environment-dependent → container, only if the repo already defines one or it is needed. No replayable artifact, no phase 4.

Plan rules: search for code, helpers and patterns to reuse first; propose the smallest change that works. Structural improvements become a follow-up Issue. They join the PR only when blocking the task, or when they remove more lines than they add in the touched area, in a separate commit.

## 5. State and self-healing

- **Local**: `.ssi/state.json` (gitignored): `run_id`, `goal`, `phase`, `next_action`, per-phase `attempts`, `branch`, `head_sha`, `issue`, `pr`, evidence entries `{path, sha}`, `pending` remote operations.
- **Remote**: hidden block `<!-- ssi:state … -->` in a PR comment, rewritten on each transition. Enables resume on another machine.
- **Truth order**: git, then PR/Issue, then local file. The file never overrides facts.

Phase detection: evidence decides the phase. The only floor is commits made *since the run started* (`start_sha`, recorded by `ssi start`): they imply at least phase 5. Pre-existing commits, an existing PR or an `ssi/` branch name never skip analysis. Review and visual evidence is restored from the PR state block.

Heal cases (each covered by an engine test):
- state file missing, or `head_sha` differs → rebuilt from facts, with a warning line;
- evidence from an old SHA on a changed surface → stale, replayed;
- branch deleted, force-push, PR closed → `STOP_REALITY`, never silently recreated;
- state comment edited by a human → re-read before every write; text outside the `ssi:begin`/`ssi:end` markers is kept, and only the block between them is replaced (a deleted block is appended again);
- network down → local work continues, remote ops queued in `pending`, replayed when back.

Idempotency: every remote effect carries key `ssi:<run_id>:<op>`; the engine searches for the key before creating (no duplicate Issue, PR, comment, asset).

Persistent stops: a stop records its reason and question; resuming requires the recorded answer. A resumed run never restarts from scratch.

## 6. Config and thresholds

Files: `ssi.config.json` (repo, versioned) and `.ssi/config.local.json` (gitignored). Precedence: defaults < repo < local < flags. `ssi config` prints the effective config. Unknown keys are errors.

```json
{
  "mandate": { "allow": ["push", "draft-pr", "issue", "comment"], "ready": false },
  "thresholds": {
    "diff": { "lines": 300, "files": 8 },
    "reproAttempts": 3,
    "reviewRounds": 2,
    "visualRetries": 2,
    "ciRetries": 2
  },
  "review": { "reviewers": ["codex", "subagent"], "parallel": false },
  "ci": { "watch": true, "reviewComments": false },
  "visual": { "enabled": "auto", "tool": "playwright" },
  "assets": { "branch": "ssi-assets", "purge": true },
  "protectedPaths": ["**/auth/**", "**/payment*/**", "**/migrations/**", "**/schema*"],
  "ui": { "style": "guided" }
}
```

- Protected-interface check (`STOP_PROTECTED`): the plan declares touched interfaces; the engine cross-checks them with `protectedPaths` and public exports. Model judgement is not the gate.
- Diff size is measured by the engine in phases 5 and 6.
- Floor that config cannot change: `merge`, `close-issue`, `deploy` are refused. A config listing them is rejected.
- `visual.enabled: "auto"`: UI surface detected from the diff (components, styles, routes); otherwise phase 7 is skipped and the PR says so.

## 7. Communication contract and cockpit

Every agent message follows one template, in plain English:

1. **Where we are**: one line plus progress bar (`▓▓▓░░░░░ 3/8 Reproduce`).
2. **What just happened**: 1–2 short sentences.
3. **What's next**: one action.
4. **Needs you?**: "No, I keep going", or **one** question with options and a recommended default.

Rules: no unexplained jargon (explain once, in one line); under 8 lines per message, details go to the PR or a file; a stop opens with "I stopped because…"; a resume opens with "Last time you were here: …" in 3 lines; one ✓ per finished phase.

Styles:
- `guided` (default): template, progress bar, one action, one question.
- `adhd`: adds specific time estimates, automatic drawings, win toasts, the full rule set adapted from the MIT-licensed `i-have-adhd` skill (lead with the action, numbered minimal steps, one under-2-minute next action, tangents deferred, wins visible, state restated each turn).
- `plain`: no template.

Drawings: in chat, an inline diagram when explaining a stop or a plan; in the PR, a Mermaid diagram (rendered by GitHub).

Cockpit mod (`ssi-cockpit`, optional, Claude Code only; reads `.ssi/state.json`, decides nothing): band above the prompt with progress, next action and ETA; status-line entry; toasts on phase done or stop; `/ssi-map` pane with the eight phases drawn, current one lit, ✓ wins and back-edges. Without the mod the skill works with the text template.

## 8. Repository layout (v1)

```
skills/ssi/SKILL.md            thin: loop + communication contract (folder is self-contained)
.claude-plugin/plugin.json     makes the repo installable as a plugin
skills/ssi/references/         one short file per phase, loaded on demand
skills/ssi/NOTICE.md           upstream MIT notices (+ i-have-adhd)
skills/ssi/scripts/ssi.mjs     engine CLI: start, next, record, answer, config, allow, issue, upload, purge
skills/ssi/scripts/lib/        phase detection, thresholds, state, remote ops
mods/ssi-cockpit/              optional Claude Code mod
tests/engine/                  deterministic engine tests
```

Migration from the current package: remove the five `--mode` flags, the 35-scenario matrix and its fixtures generator, and the permission-matrix prose; keep provenance in `NOTICE.md`; rewrite `scripts/validate.mjs` for the new layout.

## 9. Testing

1. Engine unit tests: phase detection from fixtures of git/PR state, stale evidence, every heal case, every stop code, config precedence and rejection of the floor, idempotency keys, pending-queue replay. `gh` is stubbed.
2. Three real end-to-end runs on a disposable repository before any further test is written: one bug with UI, one bug without UI, one feature. Failures are recorded and drive fixes.
3. Model-behaviour qualification is deferred until the three real runs pass.

## 10. Non-goals

Merge, deploy, closing Issues; multi-client support in v1; a GitHub Project integration; any scan of the whole repository; Docker as a default.

## 11. Risks and open items

- Raw URLs from `ssi-assets` in private repos render only for signed-in members with access; documented in the PR comment.
- Codex CLI non-interactive invocation must be verified against the installed version; the fallback chain covers its absence.
- Mods need the user's one-time approval for hot reload; the text template is the fallback.
- Protected-path detection by globs is coarse; false positives cause a stop (safe direction), false negatives are possible and documented.
- `i-have-adhd` content is reused under its MIT licence with attribution; its text is adapted, not copied wholesale.
