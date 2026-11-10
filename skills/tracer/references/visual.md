# Visual verification

Check the changed screen or interaction using the available browser. A screenshot is enough for static appearance;
use a short recording only when interaction or motion matters. Do not manufacture a GIF for every CSS change.
If no browser is available, state the limitation and ask only if visual verification is necessary to accept the work.
Record phase 7 with the real artifact and a note describing what was observed. This is reported evidence, not an automatic visual verdict.

Local route: keep artifacts in `.tracer/`; do not upload them or ask the user to validate a link.
PR route: upload useful evidence with `tracer upload --file <artifact>` and include the returned link in the PR.
Check link access when possible; disclose uncertainty instead of making link confirmation a mandatory user interruption.

When the UI or UX role applies, the observation note should say what was checked beyond appearance: keyboard focus, error and empty states,
and the main flow end to end. The note is added to the PR feedback table.
