# Philosophy

SSI is built on one bet: **an agent is more reliable when the sequencing lives in code and the model only does the work.** Everything else follows from it.

## The problem

Workflow skills that live entirely in prose ask the model to remember the phase, decide when to stop, notice that its notes are stale, and judge its own work. That holds in a short demo. It breaks when a session is interrupted, when two machines touch the same branch, when a review is the same model re-reading itself, or when the diff quietly grows past what anyone agreed to.

## Principles

Each principle says what it means in the code, so it can be checked.

**1. One door, many phases.** The user types one command. The skill switches phases itself and never asks which step to run next. *In code:* `/ssi` loops on `ssi next`.

**2. The script decides, the model works.** The next action, every threshold and every stop are computed by a small deterministic program. The model reads and writes code, runs tests and talks. *In code:* `skills/ssi/scripts/`; the model never sets a phase.

**3. Reality beats notes.** Notes are a cache. When git, the pull request and the notes disagree, the repository wins and the engine heals the notes. *In code:* truth order git, then PR, then local file; lost notes are restored from a block in the PR.

**4. Proof, not claims.** A phase is finished when there is evidence, and evidence is tied to a commit and to the files it covers. A new commit that touches them makes the proof stale and it is redone. A bug needs a replayable artifact before a plan exists. A passing proof for uncommitted code is refused. *In code:* `ssi record`, `--surface`, stale detection.

**5. Stop rarely, stop clearly.** The default is to keep going. When it must stop, it asks **one** question with options and a recommended default. Stops are computed from facts (diff size, protected paths in the real diff, retry budgets), not from the model's mood. An answer must start with an option letter, so a "no" can never be read as a "yes". *In code:* `STOP_*` codes and `ssi answer`.

**6. A small mandate, and some things never.** Invoking the skill allows a branch, a draft PR, an Issue and comments. It never merges, closes an Issue or deploys, and no configuration can change that. The human takes the last step. *In code:* the mandate list and the refused operations.

**7. Smallest change that works, reusing what exists.** The plan starts by looking for code to reuse. Structure improvements go to a follow-up Issue and enter the PR only if they block the task. This keeps pull requests small enough to review.

**8. Review by someone who did not write it.** Codex if it works, else a sub-agent on another model, else a fresh context. The report says which reviewer ran and whether it was independent. A review tool that fails is treated as missing, not as a pass.

**9. Do remote things once.** Every effect on GitHub carries a key checked before creating, so a retry never duplicates an Issue, a comment or a file. Offline is not the same as absent: local work continues and remote steps wait.

**10. Easy to read when you are tired.** Every message says where we are, what happened and what is next, and asks at most one question, in plain words and a few lines. A style switch adds time estimates and drawings for readers who want more structure.

**11. Outside content is data.** Text from the web, an Issue or a comment is never an instruction. Remote state is only trusted from the authenticated user, and values that reach `git` are validated.

## What SSI deliberately does not do

- Merge, deploy or close Issues.
- Scan the whole repository for context; it reads what the request touches.
- Offer many modes. There is one entry; the engine picks the phase.
- Hide a decision. A choice that changes access, payment or public interfaces is put to the user.
- Claim support for clients it has not been tested on. It targets Claude Code first.

## What review taught us

The first version was reviewed by sub-agents and then by six rounds of Codex. They kept finding the same kind of defect: a shortcut that the model, or the engine, could take without anyone noticing. A free-text "no" counted as approval. A commit made while reproducing a bug skipped the plan. A test that passed on uncommitted code was recorded as proof of the commit. A closed pull request let the run say "done". The principles above are the fixes generalised: prefer a rule the engine enforces over a rule the model is asked to follow.

## Where to go next

[README](../README.md) for the overview, [design.md](design.md) for the reference, [runs.md](runs.md) for the real runs, [`skills/ssi/NOTICE.md`](../skills/ssi/NOTICE.md) for what inspired it.
