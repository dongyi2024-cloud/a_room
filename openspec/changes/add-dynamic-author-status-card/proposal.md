## Why

The current author status card uses static copy and does not respond to the user's current reading context or time of day. The homepage card should become a stable, cached, context-aware Woolf presence without making the AI responsible for time-period decisions.

## What Changes

- Add a backend timeMood rule that maps the current hour to one of six fixed periods: 清晨、上午、中午、下午、夜晚、深夜.
- Add a backend API for the homepage author status card that first determines timeMood, then reads the user's latest reading context, then returns cached or newly generated card copy.
- Add AI generation for the card copy using backend-provided `period`, `mood`, `scene`, `cta`, and reading context; AI must not infer or change the time period.
- Add cache persistence keyed by `user_id + card_date + time_period` so homepage refreshes do not call AI repeatedly.
- Add safe fallback copy for every time period when there is no reading record or AI generation fails.
- Update the homepage author status card to call the API and replace only dynamic fields while preserving the existing visual style, layout, buttons, and routes.
- Enforce separate voices: `woolf_status` is third-person objective observation beginning with "她"; `thought_body` is first-person Woolf-style thought.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `author-status-card`: change the author status card from static/display-only behavior into a homepage dynamic card backed by deterministic timeMood rules, user reading context, AI rewrite, cache, and fallbacks.

## Impact

- Affected UI: homepage author status card only; existing visual structure, button routes, and responsive behavior must remain intact.
- Affected APIs: add `GET /api/author-status`.
- Affected data: add or reuse an `author_status_cards` cache table with a unique constraint on `user_id`, `card_date`, and `time_period`.
- Affected AI: add a constrained generation path for author status card copy; this simple single-step generation does not require LangGraph because there is no multi-turn state, tool routing, or node workflow.
- Affected auth/data access: API must identify the current user and must not expose or use another user's reading history.
