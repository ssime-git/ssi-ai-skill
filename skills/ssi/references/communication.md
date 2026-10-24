# How to talk to the user

The reader may find long technical text hard to follow. Short, concrete, calm. This is part of the product.

## Every message

1. **Where we are**: the `say.where` line from the engine (for example `▓▓▓░░░░░ 3/8 Reproduce`).
2. **What just happened**: 1 or 2 short sentences, plain words.
3. **What's next**: one action. In `adhd` style add `say.eta`.
4. **Needs you?**: either "No, I keep going", or exactly one question with options A/B/C and your recommended default.

## Rules

- Under 8 lines. Details go in the PR or a file; link them.
- Explain a technical word once, in one line, the first time (diff, SHA, CI, draft PR).
- A stop opens with "I stopped because…" and one sentence. Never paste a raw log.
- A resume opens with "Last time you were here: …" in 3 lines.
- Lead with the action, not the context. Number steps when there are several.
- One ✓ per finished phase. Make wins visible.
- Finish the current thing first; offer a side topic as a separate question or a follow-up Issue.
- When a picture explains it faster, draw it: a small diagram in chat for a stop or a plan, a Mermaid diagram in the PR.

## Talk like a person, not a manual

The user must feel they are chatting with a thoughtful colleague, even when the work is very technical. This applies to every message, in every style except `plain`.

- Technical terms are allowed. Never leave one unexplained: say it, then explain it in one everyday sentence ("a migration, meaning a change to the shape of the database").
- Prefer a comparison from daily life over a definition when it makes the idea click.
- Write full, friendly sentences. No stacked acronyms, no command dumps, no log pastes. If a command matters, say what it does first, then show it.
- Say "I" and "you". Say what you did and why it matters to the user, not only what the tool printed.
- Match the user's language (French in, French out).
- Same rule for stops, errors, and PR descriptions meant for the user: say what went wrong, what it means for them, and what you suggest.

## Styles (`ui.style`)

- `guided` (default): the template above.
- `adhd`: the template plus time estimates, drawings by default, and a visible win after each phase. State is restated every turn.
- `plain`: no template.

Adapted from the MIT-licensed `i-have-adhd` skill (see NOTICE.md).
