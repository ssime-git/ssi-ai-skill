# SSI for Codex

Install `skills/ssi` at `~/.agents/skills/ssi` (personal) or `.agents/skills/ssi` (project).
Copy the whole folder so its references and scripts remain available. Requires Node 20+ for tracked work.
Invoke with `$ssi`, or let Codex select it for substantial or risky repository work.

If a project needs an explicit routing reminder, append only this line to its existing AGENTS.md:

> Handle clear, confined, low-risk tasks directly. Use SSI for substantial or risky work, or when saved progress is useful; follow its SKILL.md at the installed location.

The shared entrypoint chooses direct or tracked work even when explicitly invoked.
No session-start hook, extra model call or automatic engine startup is needed.
Do not paste the tracked workflow into AGENTS.md: that would load it for every task.
