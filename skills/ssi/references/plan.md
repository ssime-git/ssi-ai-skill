# Phase 4: Plan

Goal: the smallest change that works, built from what already exists.

1. Search first: existing functions, helpers, patterns, config, libraries already in the repo. Standard library and native platform features before a new dependency.
2. Write a plan of at most one page: files to touch, what is reused, how it will be tested.
3. List every public interface or protected path you will touch (auth, payments, migrations, schema, exported API). Say `--public-api` if an exported contract changes.
4. Structure ideas (renames, splits, cleanups): do **not** put them in this plan. Create a follow-up Issue for them. They join the PR only if they block the task, or remove more lines than they add in the touched area, as a separate commit.
5. Record: `ssi record --phase 4 --result pass --evidence <plan file> --touches <a,b,c> [--public-api true]`.

If the engine stops for a protected path, show the user the files and ask for approval. Do not argue the stop away.
