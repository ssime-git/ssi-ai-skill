# Philosophy

SSI aims for correct, readable results with the least necessary coordination. A workflow earns its cost
only when it prevents a concrete failure or saves later work.

- Use normal agent work for clear, confined, low-risk tasks; tracking must earn its overhead.
- Match the destination to the request: answer, local change, or authorized PR.
- Keep the common instructions short. Load a phase guide only when it changes a decision.
- Reuse before writing. Prefer explicit names, direct control flow and small interfaces.
- Add abstraction for actual repeated needs, not hypothetical future requirements.
- Let the model investigate and judge relevance; let code track state and observable execution.
- Distinguish reported artifacts, executed checks and unverified assumptions.
- Preserve bug regression tests and required project checks. Avoid tests that merely mirror implementation.
- Review substantial or risky work with a fresh perspective. A different model alone does not prove independence.
- Keep useful deferred work in a handoff or authorized Issue. Neither an Issue nor a PR is a universal prerequisite.
- Ask only when correctness, scope or authorization depends on the answer. Respect answers already given.
- Measure overhead and final outcomes separately. More steps and more tests are not automatic evidence of better work.

The original inspirations remain: mattpocock/skills and jsmastery-pro/skills for engineering practices,
DietrichGebert/ponytail for the smallest useful change, ayghri/i-have-adhd for clear communication,
openai/codex-plugin-cc for optional read-only review, and obra/superpowers for early design work.
Source versions and licences remain in skills/ssi/NOTICE.md.

See design.md for operational details and runs.md for the evidence and its limits.
