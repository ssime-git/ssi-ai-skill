# Production-risk checks

Run `ssi guards` when the actual change affects migrations, infrastructure, model tooling or prompts/evals.
The engine uses changed paths, including uncommitted local files. An unrelated documentation edit does not
inherit every production requirement simply because those tools exist somewhere in the repository.
Detection is conservative and path-based; evaluate indirect risks yourself and follow stricter project policies.

Declare a project-specific check in ssi.guards.json:
`{"guards":[{"id":"db-migration","run":"<check current case>","mustFail":"<check deliberately bad case>"}]}`.
The positive case must exit 0; the negative case must exit nonzero for the intended reason.
Missing commands, signals and timeouts make the negative check invalid. Exit codes alone cannot establish
that a test is meaningful: inspect the output and confirm it exercises the actual protection.

Contracts: db-migration, infra-unexpected-diff, model-promotion, llm-eval-gate.
An applicable uncovered contract blocks completion. Waivers need the user's authorization, author and reason:
`{"waivers":[{"id":"...","by":"<human>","reason":"..."}]}`.
The engine validates the declaration; it cannot authenticate who wrote a local JSON file.
Never invent a waiver or weaken a check to pass. Existing authorization remains valid; ask only when it is missing.
