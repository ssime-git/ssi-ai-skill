# Historical token usage and task efficiency

This report measures the pre-router SSI 0.3 development snapshot identified by its saved source hashes.
It does not measure the final 0.3.0 automatic direct/tracked entrypoint; see [routing evaluation](routing-evaluation.md) for that validation.

Measured 2026-10-25. SSI 0.3 used **21.4% fewer total tokens** and
**22.4% less elapsed time** than SSI 0.2 on this sample.
Compared with Codex alone, SSI 0.3 used **31.2% more total tokens**
and **33.2% more elapsed time**. All final outputs met the tested requirements.
This does not establish that SSI is generally more efficient than Codex alone.

## Method

Three fully specified Node tasks, two repetitions each, three conditions: **18 root runs and 7 real fresh-context reviews**.
All use the installed Codex CLI 0.163.0, requested model gpt-6.1-sol and medium reasoning.
Trials are sequential, start in separate disposable repositories and use a seeded shuffled order.
The same user request, visible code, acceptance tests and common instructions apply across conditions.
The supplied skill is the treatment; SSI 0.3 target/scope is preset per case. Automatic route inference is not evaluated.

Cases are a small mean function, a percentage-discount regression, and a shipping/discount integration delivered
as a reviewed draft PR. Acceptance assertions are kept outside the model's workspace. Visible tests also run independently.
A reviewed-PR success requires an approving fresh-context review. Root and reviewer tokens are included;
reviewer wall time is inside root wall time and is not counted twice. There were no missing usage records, timeouts or CLI error events.

GitHub and CI are local simulators. Pushes target a disposable local bare repository; no real GitHub objects are created.
Only the engine's gh executable path is substituted. Original skill sources remained unchanged, verified by hashes and a per-trial audit.
The sandbox explicitly allows the temporary repository's .git directory so a permission denial cannot masquerade as a skill failure.
No tools, models or dependencies were installed. The preliminary permission/auth probes are excluded from condition scores.

SSI 0.2 expects a PR. For local tasks, a common instruction permits finishing verified local code at the unwanted
publication boundary. Its engine therefore remains not-done on four local runs, although the requested local task is satisfied.
SSI 0.3 reaches engine completion on all six runs. The PR case is the matched-destination comparison.

## Totals for six task executions per condition

| Condition | Total input + output tokens | Input not read from cache | Output tokens | Cumulative wall time | Successful tasks |
|---|---:|---:|---:|---:|---:|
| Codex alone | 1,258,855 | 126,231 | 11,600 | 5m 04s | 6/6 |
| SSI 0.2 | 2,102,609 | 154,885 | 18,764 | 8m 41s | 6/6 |
| SSI 0.3 | 1,651,625 | 132,284 | 14,573 | 6m 45s | 6/6 |

SSI 0.3 reduces uncached input by 14.6% and output by
22.3% relative to SSI 0.2. Relative to Codex alone, these categories increase by
4.8% and 25.6% respectively.
Total processed tokens include cache reads, so the total-token ratio is not a monetary-cost ratio.
No subscription quota or euro savings are inferred.

## Per task: mean of two runs

Token totals include any reviewer. The last columns show the SSI 0.3 change in total tokens; positive means more tokens.

| Task | Codex: tokens / time | SSI 0.2: tokens / time | SSI 0.3: tokens / time | vs SSI 0.2 | vs Codex |
|---|---:|---:|---:|---:|---:|
| Small local feature | 86,380 / 31.9s | 283,510 / 71.9s | 152,691 / 43.5s | -46.1% | +76.8% |
| Local bug fix | 124,254 / 32.8s | 221,922 / 61.3s | 232,204 / 56.5s | +4.6% | +86.9% |
| Reviewed draft PR | 418,794 / 87.2s | 545,872 / 127.6s | 440,917 / 102.3s | -19.2% | +5.3% |

The improvement is not uniform. The bug fix uses slightly more total tokens in SSI 0.3 than SSI 0.2.
On the PR case, SSI 0.3 reduces the overhead of SSI 0.2, while remaining above the average Codex-alone result.
One Codex-alone PR run needed a second review because the first reviewed committed code while implementation
changes were still uncommitted. The re-review and its tokens are included. Individual paired results are retained;
for example, Codex-alone PR tokens range from 293,032 to 544,555. Two repetitions do not establish statistical significance.

## What can be concluded

SSI 0.3 is leaner than SSI 0.2 on this balanced sample, but its engine still costs tokens and time on short tasks.
There was **no measured final correctness advantage**: every condition finished 6/6 accepted tasks. The mean-function
implementations are nearly identical across conditions. The experiment does not establish a general readability benefit.
A tiny successful test set also cannot prove absence of bugs or production readiness.

Use ordinary Codex for short, well-specified local edits when minimal coordination is the priority.
SSI's plausible remaining value is in substantial work, durable evidence and interruption recovery; those benefits
need a separate longer-task/resumption experiment. Do not interpret this study as evidence for automatic SSI activation everywhere.

## Evidence and reproduction

- [Evaluation protocol and runner](../evaluations/README.md)
- [Original trial measurements](../evaluations/results/2026-10-25/trials.json)
- [Derived summary and paired comparisons](../evaluations/results/2026-10-25/summary.json)
- [Prompts, fixtures and acceptance groups](../evaluations/results/2026-10-25/manifest.json)
- [Source hashes](../evaluations/results/2026-10-25/source-hashes.json) and [integrity audit](../evaluations/results/2026-10-25/integrity-audit.json)

Raw CLI traces, reviewer outputs and final source/test artifacts are retained locally under
evaluations/results/2026-10-25/raw and artifacts; these bulky generated folders are gitignored.
Six evaluator unit tests check accounting subsets, missing usage, tool-event counting, failed trials and review requirements.

Token counts come from the CLI's turn.completed usage, as documented in
[OpenAI's non-interactive Codex documentation](https://learn.chatgpt.com/docs/non-interactive-mode).
Cached input is included in input and reasoning is included in output; see
[OpenAI's usage definitions](https://developers.openai.com/api/docs/guides/agents-api/observability).
These counters are recorded usage, not a final billing statement. The earlier
[workflow-byte benchmark](efficiency.md) measures a different quantity and must not be presented as measured model-token savings.
