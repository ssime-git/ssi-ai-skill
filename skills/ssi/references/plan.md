# Plan

Use a plan when uncertainty, multiple components or consequential choices justify one.
The engine omits this phase for a small, safe change. Do not create a second planning workflow.

Search existing code and standard tools first. Write at most one page: intended behavior, affected files,
what will be reused and how correctness will be checked. Specify interfaces and decisions, not the entire implementation.
Read callers and identify compatibility risks. Prefer fewer moving parts and familiar code a reviewer can follow.
List protected paths and public interface changes accurately with `--touches` and `--public-api`.
Record phase 4 with the plan file as evidence.

Keep unrelated improvements outside the change. Mention useful follow-ups in the handoff; create an Issue
only when it is actionable, worth retaining and authorized. A follow-up Issue is never mandatory.
Ask only about a choice that materially changes the requested result or exceeds existing authorization.
