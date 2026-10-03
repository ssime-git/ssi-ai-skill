# Phase 2: Confirm

Goal: turn "I think" into a fact.

- Bug: run the failing command, read the log, or point at the exact code path that is wrong.
- Feature gap: show the missing route, function or behaviour (a search result or a failing call).
- Save the proof in a file. Quote the exact error text when there is one.
- Record: `ssi record --phase 2 --result pass --evidence <proof file>`.
- Cannot prove it? `--result fail`. The engine sends you back to phase 1 to re-read the request. Tell the user what you could not confirm.
