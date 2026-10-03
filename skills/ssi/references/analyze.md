# Phase 1: Analyze

Goal: know what is asked, how success will be seen, and what is missing, before touching code.

1. Read the request, the code it touches end to end, and the callers.
2. Write a brief with: the goal, ONE observable success check, the gaps.
3. A gap is **blocking** only if two reasonable readers would build different things. Count only those.
4. Decide `kind`: `bug` (something that should work does not) or `feature`.
5. Record: `ssi record --phase 1 --result pass --gaps <n> --kind bug|feature --evidence <brief file>`.

If `--gaps` is above 0 the engine stops and you ask the user. Ask one question at a time, with options and your recommendation. Never invent an answer to a blocking gap.

Do not scan the whole repository. Read only what the request touches.
