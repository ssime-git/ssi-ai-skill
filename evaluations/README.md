# Real model evaluation

This evaluation measures actual Codex CLI token usage, elapsed time and held-out correctness.
It is separate from scripts/benchmark.mjs, which measures deterministic workflow text overhead.

Three conditions use the same installed Codex CLI, gpt-6.1-sol and medium reasoning:
Codex alone, SSI 0.2 at 4f486cf, and the current SSI 0.3 snapshot.
Cases: a small local feature, a local percentage-discount bug, and a reviewed draft PR integration.
Each case starts in a fresh disposable Git repository. Order is shuffled with a fixed seed per repetition.
Common instructions, visible fixtures and user requirements are identical across conditions. The supplied
skill and its configuration are the treatment. No tools, models or packages are installed by the trials.

GitHub and its CI rollup are local simulators; git pushes target a disposable local bare repository.
The evaluator independently checks behavior after each trial using assertions kept outside its workspace.
Visible tests are also executed independently. Reviewed-PR success additionally requires a real fresh-context
same-model review. Root and reviewer usage are summed. Reviewer wall time is already inside root wall time
and is not added twice. Missing usage stays unknown; it is never counted as zero-token success.

SSI 0.2 targets PRs. On local tasks the common user instruction forbids unwanted publication and permits
stopping at that boundary after code and tests. Report engine completion separately from task acceptance;
use the reviewed-PR case as the matched-destination comparison. Do not interpret the local cases as evidence
that SSI 0.2's full PR pipeline can be replaced without changing the requested deliverable.

## Run

Use an existing authenticated CLI binary directly, not an installer wrapper. Baseline must be a checkout
of 4f486cf. Do not run model trials from ordinary CI without explicit authorization for the model usage.

```bash
python evaluations/run_model_eval.py \
  --codex /path/to/installed/codex \
  --baseline /path/to/ssi-v02 \
  --output /tmp/ssi-real-evaluation --repeats 2
python evaluations/summarize_model_eval.py /tmp/ssi-real-evaluation/trials.json \
  --output /tmp/ssi-real-evaluation/summary.json
python -m unittest discover -s evaluations -p 'test_*.py' -v
```

An existing output directory resumes completed cells. Keep raw CLI events, reviewer outputs, trial metadata
and acceptance results. Do not infer monetary charges from a ChatGPT subscription's token counts.
Inspect cached input and output separately; total processed tokens alone do not establish cost savings.
A few small tasks establish an exploratory result, not broad production performance or statistical significance.

## Automatic routing smoke tests

`run_routing_eval.py` uses installed, authenticated Codex and Claude Code binaries.
It runs the two local fixtures without preset SSI target/scope, and checks held-out behavior
and the absence of SSI engine state. Claude invokes the project skill natively with `/ssi`;
Codex explicitly reads the installed entrypoint, with host skill discovery disabled for isolation.
A separate decision-only batch covers ambiguity, risk, tracking requests and escalation.
A tracked answer case also verifies engine completion, no source changes, and no GitHub calls on both hosts.
This does not measure implicit activation recall, full reviewed-PR execution on Claude, or general token savings.

```bash
python evaluations/run_routing_eval.py --codex /path/to/codex --claude /path/to/claude \
  --output /tmp/ssi-routing-eval
```

CLI outputs contain local trial paths. Publish only reviewed fixture evidence and summaries;
keep raw logs and workspaces ignored. Results use each provider's own usage fields, not a cross-model cost estimate.
