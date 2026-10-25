---
name: "ssi"
description: "Handle substantial or risky repository work with verified, resumable progress. Simple tasks stay direct, including when SSI is explicitly invoked."
---

# SSI

Choose the least workflow that completes the user's task. Reassess for each new task;
loading SSI does not require starting its engine.

Understand the expected result and how to check it. Read only the context needed to decide;
ask only when missing information changes correctness, scope or authorization.
Ambiguity alone does not justify tracked work.

- **Direct:** clear, confined, low-risk work with straightforward verification.
  Use the host agent's normal tools, make the smallest readable change, reuse existing code,
  and run relevant checks. Keep bug reproduction/regression when applicable.
  Do not load workflow guides or create SSI state, plans, Issues or PRs just for process.
- **Tracked:** substantial work with coupled changes, significant safety or compatibility risk,
  a difficult investigation, or a concrete need for saved progress, formal review or handoff.
  Read [workflow](references/workflow.md), then start or resume its engine.
  A tiny authentication, permission or data-migration change can still be risky.

If direct work reveals broader impact, unresolved failures or significant uncertainty,
escalate using evidence already gathered. Do not restart an active tracked task to bypass a stop.
Explicit requests for tracking or a direct approach take precedence within project requirements.

Follow project instructions and existing authorization. Local work needs no publication.
Never merge, close an Issue or deploy. Report the result, checks and material limits.
