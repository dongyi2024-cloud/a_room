## 1. Data Model And Types

- [x] 1.1 Add `feedback_reports` to Supabase schema with user, target, feedback type, content, status, metadata, and timestamps.
- [x] 1.2 Add minimal moderation fields to `reflection_cards` for repeated-report review state.
- [x] 1.3 Update generated Supabase TypeScript table types and add app-level feedback/report request and response types.
- [x] 1.4 Add indexes and RLS policies so users can create/read their own reports while database/admin review remains possible.

## 2. Server Logic

- [x] 2.1 Add validation helpers for supported target types and feedback types.
- [x] 2.2 Add feedback/report creation data-layer function that validates authentication and target shape.
- [x] 2.3 Verify reflection-card targets exist before accepting reports.
- [x] 2.4 Add repeated-report threshold logic that updates reflection-card report count and pending-review status.
- [x] 2.5 Add `POST /api/feedback` endpoint with friendly validation and failure messages.

## 3. Shared UI Component

- [x] 3.1 Add a reusable feedback/report action component with target label, type selection, optional detail text, submit, cancel, loading, success, and failure states.
- [x] 3.2 Ensure the component does not expose hidden private metadata or full dialogue history by default.
- [x] 3.3 Style the component for desktop and mobile without blocking unrelated reading or community browsing.

## 4. AI Answer Feedback

- [x] 4.1 Add feedback action below completed selected-text AI answer turns.
- [x] 4.2 Include safe AI answer context: book id, chapter order, paragraph order, selected text excerpt, question/turn key, answer excerpt, and citation count.
- [x] 4.3 Ensure failed feedback submission does not remove or alter the AI answer.

## 5. Community Report Flow

- [x] 5.1 Add report action to reflection cards in community and paragraph feeds.
- [x] 5.2 Submit reflection-card reports through the shared feedback endpoint.
- [x] 5.3 Ensure report success and failure states are visible and scoped to the card.
- [x] 5.4 Ensure pending-review status does not break existing feed rendering.

## 6. Tests And Validation

- [x] 6.1 Add tests or source checks for schema, RLS, generated types, and API route presence.
- [x] 6.2 Add tests or source checks for AI answer feedback target context and privacy bounds.
- [x] 6.3 Add tests or source checks for community card report submission and repeated-report pending-review behavior.
- [x] 6.4 Run any existing reflection/AI relevant tests plus the new feedback/reporting test script.
- [x] 6.5 Run `npx tsc --noEmit`.
- [x] 6.6 Run `npm run build`.
- [x] 6.7 Run `openspec validate add-feedback-and-reporting --strict`.
- [x] 6.8 Manually verify PC and mobile: AI answer feedback, community card report, type selection, optional detail, success message, failed submission state, database record, and repeated report review state.
