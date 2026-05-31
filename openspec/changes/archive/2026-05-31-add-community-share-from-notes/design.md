## Context

The project already has two related surfaces:

- `personal_notes`: private, owner-only notes that can store AI answers, smart mark explanations, selected text, reading reflections, and dialogue summaries.
- `reflection_cards`: public/community paragraph-bound reflection cards shown in the reader paragraph feed and the aggregated `/community` feed.

F34 connects these surfaces. The key product constraint is privacy: a dialogue summary note can contain metadata with original dialogue turns, but the public community card must only contain the user-reviewed share content.

## Goals / Non-Goals

**Goals:**
- Add a share-to-community action for eligible personal notes, including `dialogue_summary` notes.
- Generate a safe initial share draft from the note's saved public-facing fields.
- Require user review and editing before publishing.
- Publish confirmed shares into the existing paragraph-bound reflection card feed.
- Keep note ownership, book ownership, chapter binding, and paragraph binding enforced on the server.
- Keep the flow usable on desktop and mobile.

**Non-Goals:**
- Do not create a generic context-free community composer.
- Do not expose or publish full original AI dialogue history by default.
- Do not add following, comments, private messages, moderation queues, or recommendation ranking.
- Do not require an AI/LangGraph workflow for draft creation in this stage; the draft can be deterministically derived from note fields.
- Do not change the core card feed layout beyond what is needed to show cards created from notes.

## Decisions

### Reuse `reflection_cards` as the public artifact

Published shares should become normal reflection cards. This keeps the existing community page, paragraph feed, likes, deletion, RLS expectations, and card rendering path intact.

Alternative considered: create a separate `community_note_shares` table. That would duplicate feed, like, and delete behavior for content that is functionally the same public card, so it is not justified for P1.

### Add source-note validation before publishing

The server should publish from a note only after loading the note by `noteId`, verifying `note.user_id === current_user.id`, and validating that the referenced book/chapter/paragraph still belongs together and is accessible to that user.

This avoids trusting client-supplied context fields and prevents users from publishing another user's private note or attaching content to an unrelated paragraph.

### Keep the share draft deterministic

The initial draft should be built from visible note fields:

- `dialogue_summary`: prefer the edited saved summary (`note_content`), then `ai_content`.
- `selected_text`: prefer `note_content`, then `source_text`.
- `ai_answer` / `smart_mark_explanation`: prefer `note_content`, then `ai_content`.
- `reflection`: prefer `note_content`.

The draft should not include raw `metadata.conversationTurns` or other hidden private metadata. This keeps F34 out of AI orchestration scope; LangGraph is not needed because no model generation or multi-node AI workflow is required.

### Use an explicit review state on the notes page

The notes page should present “分享到社区” as a restrained per-note action. Activating it opens an inline or modal confirmation editor with:

- generated draft text;
- related book/chapter/paragraph context;
- publish, cancel, and saving states;
- clear failure handling.

The card is only created after the user confirms.

### Preserve public/private boundary in API shape

The publish request should contain the owned `noteId` and edited public `content`. It should not accept arbitrary `bookId`, `chapterId`, `paragraphId`, or dialogue metadata from the client. The response can return the created card and enough context to update or link to the community feed.

## Risks / Trade-offs

- Public card duplicates private note content -> Make the UI explicit that confirming creates a community-visible card.
- Dialogue summaries may mention private context -> Default draft excludes raw dialogue turns, and the user must review/edit before publishing.
- Existing `reflection_cards` has no source-note linkage -> P1 can work without linkage, but adding optional metadata/source fields may help prevent duplicates and support future auditing.
- A referenced book or paragraph may have been deleted -> Server validation must reject publishing and the UI must keep the original note visible with a failure message.
- Duplicate shares from the same note are possible unless constrained -> P1 can either allow repeated shares or add a source-note uniqueness rule; implementation should choose one behavior and test it.
