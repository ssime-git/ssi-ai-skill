# Contributing

Keep changes focused on correct behavior, readable code and proportionate workflow.
An Issue is useful for a durable problem or proposal, but is not required before every fix.

## Local checks

Use Node 20+ and git. The engine has no runtime package dependencies.

```bash
npm run validate
npm test
python3 -m unittest discover -s evaluations -p 'test_*.py' -v
npm pack --dry-run --ignore-scripts
```

Python is needed only for evaluation tooling. CI runs the validator and engine tests on Node 20 and 22.
Use `node --test --test-isolation=none tests/engine/*.test.mjs` on newer Node versions to show individual tests.
Keep package.json and .claude-plugin/plugin.json versions aligned; the optional cockpit has its own version.

## Behavioral evaluation

Read [evaluations/README.md](evaluations/README.md) before running model trials.
These use authenticated installed CLIs and consume model usage; they are opt-in and do not run in ordinary CI.
Keep fixture requirements, independent assertions, raw failures and provider usage conventions explicit.
Do not turn text-byte savings into token or monetary claims. Never publish raw auth output or secrets.

Open a focused PR with the concrete problem, resulting behavior and relevant validation.
Preserve the SSI engine's boundaries: it does not merge, close Issues or deploy.
Security reports belong in the private channel described in [SECURITY.md](SECURITY.md).
