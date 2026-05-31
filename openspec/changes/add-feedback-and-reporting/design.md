## Context

The app already has AI answer surfaces, grounded citations, community reflection cards, likes, deletion, personal notes, and community sharing. F48 adds a governance and quality feedback capture layer over these existing surfaces.

The P1 requirement is not a full moderation console. The system only needs to collect structured feedback/report records, make them visible in the database, and mark repeatedly reported community content for review.

## Goals / Non-Goals

**Goals:**
- Let logged-in users submit structured feedback on AI answers and system issues.
- Let logged-in users report community reflection cards or other user-published content.
- Store each record with `user_id`, target type, target id or target context, feedback type, optional detail content, status, and timestamps.
- Validate target shape server-side and avoid trusting client-only labels.
- Show clear loading, cancel, success, and failure states.
- Make records reviewable from Supabase/database in P1.
- Mark repeatedly reported community cards as needing review using a simple threshold.

**Non-Goals:**
- Do not build a full admin moderation dashboard in this change.
- Do not add comments, appeals, moderator assignment, or complex workflow queues.
- Do not automatically delete community content based only on reports.
- Do not expose one user's private book text, private notes, or hidden AI dialogue to other users through feedback records.
- Do not use AI/LangGraph for feedback classification; this is a structured CRUD/governance workflow.

## Decisions

### Add `feedback_reports` as the canonical record

Use one table for both feedback and reports:

- `target_type`: `ai_answer`, `reflection_card`, `user_content`, `system_issue`.
- `target_id`: optional string/uuid for concrete records such as reflection card ids.
- `feedback_type`: `ai_answer_wrong`, `citation_inaccurate`, `inappropriate_content`, `offensive_or_uncomfortable`, `bug`, `other`.
- `content`: optional user detail text.
- `status`: `open`, `in_review`, `resolved`, `dismissed`.
- `metadata`: JSON for safe context such as book id, chapter order, paragraph order, answer turn index, citation count, current path, or client surface.

This keeps the data queryable in Supabase and avoids creating separate tables for each target class.

### Keep target validation conservative

For `reflection_card`, the server should verify that the card exists before accepting the report. For `ai_answer`, the client may not have a persisted AI answer id, so the server can accept a generated turn key or context metadata but should require book/chapter/paragraph or surface context. For `system_issue`, the server can accept route/path metadata.

### Add minimal review state to community cards

To satisfy “被多次举报的内容可以进入待审核状态,” the implementation should add minimal moderation fields to `reflection_cards`, for example:

- `moderation_status`: `visible`, `pending_review`, `hidden`.
- `report_count`: integer.

When report count reaches a configured P1 threshold, the card moves to `pending_review`. P1 should keep cards visible unless later moderation policy decides otherwise.

Alternative considered: derive all review state dynamically from `feedback_reports`. That works for database review but makes feed queries and visible status harder to reason about, so a denormalized card status is acceptable for P1.

### Privacy boundary

Feedback records should store enough context for review, but not full private book content or hidden dialogue history by default. AI answer feedback can include a short answer excerpt and selected text excerpt only if the user is submitting from their own session and the data remains in an owner/admin review table.

### RLS and service-role validation

Users can create and read their own feedback records. Admin/database review can happen through Supabase or service-role access. Any server route using service role must still validate the current logged-in user and target shape before insert.

## Risks / Trade-offs

- False or abusive reports -> Store reporter identity and do not automatically hide content in P1.
- Private context leakage -> Limit metadata and excerpts; do not copy full dialogue or full book chunks by default.
- AI answers are not persisted -> Use stable client-provided context/turn metadata rather than inventing a fake answer id.
- Repeated report threshold may be crude -> Make threshold explicit in code/tests and keep moderation status reversible.
- Schema migration required -> Keep table/columns small and document Supabase SQL updates clearly.
