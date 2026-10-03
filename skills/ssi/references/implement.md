# Phase 5: Implement

1. Branch: if you are on the base branch, create `ssi/<short-name>`. Never push the base branch; if the engine says `create-branch`, do it before anything else.
2. Test first: write a test that fails for the right reason (for a bug, the phase 3 artifact becomes a regression test). Run it and see it fail.
3. Write the least code that passes. Reuse before writing. Commit in small steps.
4. The engine then asks you to push and open a **draft** PR: `gh pr create --draft`. Put `Closes #<issue>` in the body when there is an Issue.
5. Run the full test suite. Record: `ssi record --phase 5 --result pass|fail --evidence <test output> --surface <dirs you changed>`.

`--surface` tells the engine which later changes make this proof stale. Be accurate. After a fix that follows a failed review or CI, the engine will ask you to push (`push-changes`) before it lets review or CI run again.

Performance work: measure before, change, measure after, with the same conditions. If the diff grows past the limit the engine stops you; offer to split the work.
