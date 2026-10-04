# SSI design reference

This is the reference for how SSI works today. For the reasons behind it, read [philosophy.md](philosophy.md). For the evidence it works, read [runs.md](runs.md). When this file and the code disagree, the code wins and this file is a bug.

## 1. What it does

`/ssi <request>` takes a request from "maybe unclear" to a pull request that is ready for a human. It moves through eight phases on its own, remembers the next step, repairs itself when its notes and reality disagree, and stops with **one** question only when it must. It never merges, closes an Issue or deploys.

Success: the user invokes `/ssi`, walks away, and comes back to a draft PR with green CI, a review report and (for UI work) a GIF, or to one clear question explaining why it stopped.

## 2. Architecture

```
user ──/ssi──▶ SKILL.md (thin)
                 │  loop:
                 ▼
          ssi next ──▶ {phase, action, stop?, say, warnings}
             ▲                         │
             └──── model does the work ◀┘   (code, tests, gh, review)
                   and reports with `ssi record`
```

- The engine (`skills/ssi/scripts/`) is deterministic Node with no dependencies. It reads git, `gh`, `.ssi/state.json` and the config. It writes `.ssi/` and its own marked GitHub objects.
- The model never decides the phase, a threshold or a stop. It executes the returned `action` with the client's tools and reports the proof.
- Each phase has a short guide in `skills/ssi/references/`, read only when that phase is active.
- The skill folder is self-contained: it works copied into `~/.claude/skills/` and run from any repository.

Commands: `start`, `next`, `record`, `answer`, `config`, `allow`, `issue create|skip`, `upload`, `purge`. Output is JSON; errors are `{ "error": "…" }`.

`ssi next` returns:

```json
{ "phase": 5, "name": "implement",
  "action": { "kind": "implement", "headline": "…", "instructions": "…", "refs": ["references/implement.md"], "requires": [] },
  "stop": null,
  "say": { "where": "▓▓▓▓▓░░░ 5/8 Implement", "next": "…", "needs_user": false },
  "warnings": [], "done": false }
```

Action kinds: `start`, `analyze`, `confirm`, `reproduce`, `open-issue`, `plan`, `create-branch`, `implement`, `open-draft-pr`, `verify-implementation`, `push-changes`, `review`, `capture-visual`, `watch-ci`, `commit-changes`, `wait-for-github`, `mark-ready`, `done`.

## 3. Phases

| # | Phase | Exit evidence | If it fails |
|---|---|---|---|
| 1 | Analyze | Brief: goal, one observable success check, listed gaps | a blocking gap → `STOP_UNCLEAR` |
| 2 | Confirm | The gap or bug established by a fact | not confirmed → back to 1 |
| 3 | Reproduce (bugs only) | A replayable artifact, then the Issue | repeated failure → `STOP_NO_REPRO` |
| 4 | Plan | Smallest plan, reuse list, declared touched files | protected code or public API → `STOP_PROTECTED` |
| 5 | Implement | Tests green on committed code, branch pushed, **draft PR open** | big diff → `STOP_BIG_DIFF` |
| 6 | Review | Independent review report, blockers fixed | rounds used up → `STOP_REVIEW` |
| 7 | Visual (UI only) | GIF on `ssi-assets`, linked in the PR | retries used up → `STOP_VISUAL` |
| 8 | Land | CI green; PR stays draft unless the config allows ready | CI retries used up → `STOP_CI` |

Back-edges: a failed review, visual check or CI returns to phase 5 and records the failure report so an interrupted fix can resume. Failing any phase removes its evidence and everything built on it.

Phase 5 has sub-steps decided from facts: `create-branch` on the base branch (never push the base), `implement` until a commit exists after the plan (or after the last failure), `open-draft-pr`, then `verify-implementation`. After a back-edge, `push-changes` runs before review, visual or CI if the PR is behind. `done` is refused while changes are uncommitted or GitHub is unreachable.

Reproduction is chosen by bug type: failing test (logic), replayable request (API), headless-browser capture (visual), container only if the repository already defines one. No replayable artifact, no plan.

## 4. State and self-healing

Truth order: **git, then the PR, then the local file.** The local file `.ssi/state.json` is a cache and never overrides facts.

- **Local:** `.ssi/state.json`, protected by `.ssi/.gitignore` (repaired if it lacks a `*` rule). Fields: run id, goal, kind, branch, `head_sha`, `start_sha`, `work_sha`, issue, `issue_skipped`, pr, evidence (`{path, sha, surface}`), attempts, plan, approvals, stop, `last_failure`, `last` (what the engine last answered), queued operations.
- **Remote:** a hidden block in a PR progress comment, rewritten when progress changes. Only comments of the authenticated user are read or written.
- **Phase** is decided by recorded evidence alone. Commits, an existing PR or a branch name never skip a phase.
- **Stale proof:** evidence for implement, review, visual and land is bound to the commit and to the files it covers (`--surface`). A later commit touching them makes it stale and it is redone. A passing proof is refused while changes are uncommitted.

Heal cases, each covered by tests:
- local notes missing → restored from the PR block; a newer PR block (another machine) wins over an older cache; the progress timestamp moves only on real progress;
- branch deleted, history rewritten, PR closed, or another branch checked out → `STOP_REALITY`, adopted only after an answer; a PR on another branch is never touched;
- GitHub unreachable → the PR is *unknown*, not absent: local work continues, remote steps wait, a queued Issue is replayed later (and dropped if skipped);
- a human edits the progress comment → text outside the markers is kept;
- several PRs or Issues in the repository → the run's own PR is preferred and every page of results is read.

Idempotency: every remote effect carries a key (`ssi:<run>:<op>`) searched before creating, so there is no duplicate Issue, comment or asset. The evidence GIF lives under `pr-<n>/` on an orphan `ssi-assets` branch, linked as `github.com/<owner>/<repo>/blob/ssi-assets/<path>?raw=true` so it renders in private repositories. The remote copy of that branch wins; assets of closed and merged PRs are purged on request.

## 5. Stops and mandate

Stops are computed, not judged: unclear request, no reproduction, protected code, big diff, repeated review or CI failure, an action outside the mandate, or reality diverging from the notes. An answer must start with an option letter (`A` or `B`); anything else is refused, so "no, do not touch auth" can never count as approval. `B` clears the stop and the condition is re-checked on the next call.

- **Protected code** is judged from the plan **and the real diff**, per file; each approval names its files. Defaults: auth, payments, migrations, schema.
- **Big diff** defaults to 300 lines or 8 files. An approval raises the limit by one threshold, not forever.
- **Mandate:** invoking the skill allows push, draft PR, Issue and comments in this repository. `ready` is off by default. `merge`, `close-issue` and `deploy` are refused by the engine and rejected in config.

## 6. Configuration

`ssi.config.json` (repository) and `.ssi/config.local.json` (personal). Precedence: defaults, repository, local, flags. Unknown keys are errors; `ssi config` prints the effective values.

```json
{
  "mandate": { "allow": ["push", "draft-pr", "issue", "comment"], "ready": false },
  "thresholds": { "diff": { "lines": 300, "files": 8 }, "reproAttempts": 3, "reviewRounds": 2, "visualRetries": 2, "ciRetries": 2 },
  "review": { "reviewers": ["codex", "subagent"], "parallel": false, "codexModel": "", "codexEffort": "" },
  "ci": { "watch": true, "reviewComments": false },
  "visual": { "enabled": "auto", "tool": "playwright" },
  "assets": { "branch": "ssi-assets", "purge": true },
  "protectedPaths": ["**/auth/**", "**/payment*/**", "**/migrations/**", "**/schema*"],
  "ui": { "style": "guided" }
}
```

`assets.branch` may never be `main`, `master`, `trunk`, `develop` or `HEAD`, and the engine also refuses the base branch and the current branch at run time. `codexModel` and `codexEffort` are plain names, empty by default so Codex uses the user's own configuration.

## 7. Review

Order: Codex CLI (`codex exec review --base <base>`, read-only, no approvals), then a sub-agent on another model, then a fresh-context sub-agent. Codex that is missing, logged out or failing for any reason (an unsupported model counts) is treated as missing and the reason is reported. The report states which reviewer ran and whether it was independent. Findings use one shape: verdict, summary, findings (severity, file, lines, confidence, recommendation), next steps. This follows `openai/codex-plugin-cc`.

## 8. Communication

Every message: where we are (a progress bar), what happened, what is next, and either "no need for you" or exactly one question with a recommended default. Plain words, under eight lines, jargon explained once, a stop opens with "I stopped because…", a resume opens with "Last time you were here…". Styles: `guided` (default), `adhd` (adds time estimates, drawings, visible wins), `plain`. The optional `mods/ssi-cockpit` mod shows the same state as a band, a status line, toasts and a phase map; it reads `.ssi/state.json` and decides nothing.

## 9. Layout

```
skills/ssi/SKILL.md          thin loop and message rules
skills/ssi/references/       one short guide per phase, plus communication
skills/ssi/scripts/          the engine (ssi.mjs and lib/)
skills/ssi/NOTICE.md         upstream notices
mods/ssi-cockpit/            optional Claude Code mod
tests/engine/                deterministic tests
.github/workflows/ci.yml     validator and tests on Node 20 and 22
docs/                        this reference, the philosophy, the real runs
```

## 10. Verification and limits

Engine tests run against real temporary git repositories with a stubbed `gh`. Three real runs on a disposable GitHub repository, review by sub-agents and by Codex are recorded in [runs.md](runs.md).

Not covered yet: the visual and CI stops outside tests, `ssi purge` on real closed PRs, Windows paths, forks, the cockpit in a live session, and the last wave of Codex fixes (not re-reviewed). Protected-path detection by globs is coarse: a false positive stops the run, which is the safe direction.
