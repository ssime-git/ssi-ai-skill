# Workflow overhead measurement

For actual model token usage, elapsed time and accepted correctness, see [the real model evaluation](model-evaluation.md). The percentages below measure workflow text only.

Recomputed for the final SSI 0.3.0 instructions on 2026-10-25, Node 26.8.1, against baseline commit 4f486cf (SSI 0.2).
All rows explicitly start the tracked engine; they do not measure the direct path.
The replay implements the same tiny discount helper and executes an assertion that total(100, 20) equals 80.
It supplies a deterministic fixture review, not an LLM review, and stubs GitHub. No remote objects are created.
Raw results: [efficiency.json](efficiency.json). Runner: [benchmark.mjs](../scripts/benchmark.mjs).

| Requested destination | Engine calls: old → new | Engine output bytes | Instructions + engine output bytes | GitHub calls: old → new |
|---|---:|---:|---:|---:|
| Small tracked local change | 17 → 6 | 7,255 → 1,286 (-82%) | 22,768 → 9,795 (-57%) | 22 → 0 |
| Standard tracked local change | 17 → 12 | 7,255 → 3,035 (-58%) | 22,768 → 15,355 (-33%) | 22 → 0 |
| Standard draft PR | 17 → 17 | 7,255 → 4,376 (-40%) | 22,768 → 17,708 (-22%) | 22 → 24 |

The baseline always requires a PR, even when the requested result is local. The revised local routes avoid
that unnecessary destination; the PR row compares the same destination and retains the standard review.
Two extra GitHub reads on the PR route inspect actual CI results rather than trusting a free-text note.
Instruction bytes include SKILL.md, the conditional workflow.md, communication.md and each selected action reference once. Engine output
includes every command's returned JSON. Repeated identical replays may differ slightly in temporary paths.

## What this establishes

The tested routes produce less workflow text and local routes use fewer engine calls and no GitHub queries.
This is a reproducible engineering measurement of coordination overhead. It is not an estimate of total
model-token savings: tokenization, caching, source-code reads, generated patches, reasoning and model mistakes
are excluded. It does not establish that the generated code is better, nor compare SSI with Codex alone.

The [historical model comparison](model-evaluation.md) measured a pre-router development snapshot.
For a new paired comparison of the final router, pin the model, repository commit and acceptance tests; run paired sessions
with no skill, a concise AGENTS.md, and SSI on small edits, bugs, multi-file features and investigations.
Measure accepted correctness, human interventions, total tokens/cost and elapsed time; retain failed runs.
Prefer a narrower routing correction over adding another universal rule when a case regresses.

## Reproduce

```bash
git worktree add --detach /tmp/ssi-v02 4f486cf
node scripts/benchmark.mjs /tmp/ssi-v02
```

Tests verify execution records, stale snapshots, pre-fix reproduction, CI states, optional follow-up tracking,
retry budgets, unconventional branches and negative-check failures. Tests of workflow mechanics complement
acceptance testing; they do not substitute for it. See [runs.md](runs.md) for the self-use and review results.
