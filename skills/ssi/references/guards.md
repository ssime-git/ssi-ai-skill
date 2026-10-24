# Guards: real blocks, not instructions

A sentence in `AGENTS.md` is advice. A guard is a check that actually fails the pipeline. Principles are fixed; the check is written by you for this project; the engine proves it works.

Principles: least privilege (the agent has no prod credentials), irreversible actions need a human, an unexpected diff blocks, every threshold is measured and comes from the project, never copied.

## Steps

1. `ssi guards` prints, per contract, `applies` and a status. Contracts: `db-migration`, `infra-unexpected-diff`, `model-promotion`, `llm-eval-gate`.
2. For each `uncovered` one, write the check in this project's own tools (CI job, script, policy). Do not paste a generic template; read the repo first.
3. Declare it in `ssi.guards.json`:
   `{"guards":[{"id":"model-promotion","run":"<passes on the current tree>","mustFail":"<runs the check on a deliberately bad case; must exit non-zero>","params":{"min_f1_gain":"<from the project's metrics>"}}]}`
4. `pass` needs: `run` exits 0 and `mustFail` exits non-zero. `unproven` means the check never blocked anything: fix it. An empty param is `invalid`.
5. A contract you cannot cover: add `{"waivers":[{"id":"…","by":"<human>","reason":"…"}]}` only after asking the user. Never waive on your own.

`ssi guards` exits 1 until every applicable contract is `pass` or `waived`. Do not land while it exits 1. Never weaken a check to make it pass.

Human-only decisions (ask, do not decide): new external dataset, label definition change, deleting a model or dataset, a marginal or ambiguous gain, regulatory or large cost impact.
