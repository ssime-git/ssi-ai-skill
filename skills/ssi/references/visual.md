# Phase 7: Visual proof (UI changes only)

The engine skips this phase when the diff has no UI surface.

1. Start the app the way the repo documents it.
2. Drive it with a headless browser (Playwright) through the changed flow. Record a short GIF, at most 15 seconds.
3. `ssi upload --file <gif>`. It stores the file on the `ssi-assets` branch and prints Markdown.
4. Paste that Markdown into the PR body under "Proof".
5. `ssi record --phase 7 --result pass|fail --evidence <gif path>`.

`fail` means the screen is not right: fix it (back to phase 5). Never edit the GIF. If no browser is available, say so; do not claim visual proof.
