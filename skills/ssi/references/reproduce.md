# Phase 3: Reproduce (bugs only)

Goal: a replayable artifact that fails for the reason the user reported. No artifact, no plan.

Pick the method by the kind of bug:

| Bug | Artifact |
|---|---|
| Pure logic | A failing unit test |
| API or CLI | A saved request or command that returns the wrong result |
| Visual | A headless-browser script (Playwright) that captures the wrong screen |
| Needs a dirty environment | A script run in a container, only if the repo already has a compose file or devcontainer, or the bug truly needs it |

Run it and watch it fail. Reduce it to the smallest case. For an intermittent bug, run it many times and write down the failure rate.

Record: `ssi record --phase 3 --result pass|fail --evidence <artifact path>`.

When `ssi next` then returns `open-issue`, run `ssi issue create --title "<short>" --body "<what fails, how to replay, artifact path>"`. The engine dedupes it and queues it if GitHub is unreachable.
