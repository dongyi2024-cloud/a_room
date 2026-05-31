## Why

P1 has AI answers, citations, community cards, and share flows, but users currently have no structured way to report bad AI output, inaccurate sources, harmful community content, or system problems. F48 adds the feedback and reporting capture layer needed for product improvement and basic content governance.

## What Changes

- Add a feedback/report submission capability for AI answers, community reflection cards, user-published content, and system issues.
- Store feedback reports with `user_id`, target type, target id or context, feedback type, optional details, status, and timestamps.
- Add user-facing feedback/report actions on AI answers and community cards.
- Provide success, loading, cancel, and failure states on desktop and mobile.
- Make submitted records reviewable from the database; no full admin moderation dashboard is required in P1.
- Add a simple moderation signal so repeatedly reported community content can be marked for review.

## Capabilities

### New Capabilities
- `feedback-and-reporting`: Defines feedback/report data capture, supported targets, feedback types, UI submission flows, ownership/security rules, database reviewability, and repeated-report moderation state.

### Modified Capabilities
- `reflection-card-feed`: Adds a report entry for community reflection cards and describes how reported cards can enter a review state.
- `selection-ai-panel`: Adds a feedback entry for AI answers returned in the reader selection AI panel.

## Impact

- Supabase schema/types: add `feedback_reports` and any minimal target review/status fields needed for repeated community reports.
- API: add a feedback/report submission endpoint that validates authentication and target shape.
- Reader AI UI: add feedback action below completed AI answers.
- Community/reflection UI: add report action on community cards.
- Data privacy: store enough context for review without exposing private book content across users.
- Tests: cover AI answer feedback, community report, target binding, authentication, repeated report review state, and PC/mobile-safe UI.
