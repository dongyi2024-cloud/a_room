## Context

The reader already supports paragraph-bound selected-text AI conversations in `components/reader/reader-shell.tsx`, with recent turns held in component state and sent to `/api/ai/selection`. F12 added `personal_notes`, `SaveNoteButton`, `/api/notes`, and `/settings/notes` so generated content can be saved as private notes after explicit user action.

F15 is the first note feature that requires a new AI generation step. It should follow the project AI constraint: conversation summarization is AI orchestration over prior turns and reading context, so the runtime should use a small LangGraph workflow rather than a single unobservable helper call.

## Goals / Non-Goals

**Goals:**

- Let a user generate a draft summary for the currently open paragraph-bound AI conversation.
- Include core user questions, AI answer points, related selected/original text, and optional follow-up questions in the draft.
- Require user review before persistence; saving only happens after explicit confirmation.
- Let the user edit the draft summary before saving.
- Save the confirmed summary as a private personal note with `user_id`, `book_id`, `chapter_id`, `paragraph_id`, and an original conversation reference.
- Let notes created from dialogue summaries link back to the original conversation context when available.
- Keep desktop and mobile flows usable without blocking the reading surface.

**Non-Goals:**

- No silent automatic creation of notes when every AI conversation ends.
- No permanent storage of every raw AI turn unless needed for the confirmed summary and conversation return path.
- No public sharing of summaries; community sharing belongs to a later feature.
- No cross-book or global conversation summary center.
- No long-term memory writes from dialogue summaries in this change.

## Decisions

### 1. Generate a draft, then save only after confirmation

The UI should expose "生成摘要" on an eligible AI dialogue. The first action calls a summary endpoint and returns an editable draft; the second action saves the confirmed text as a note. This matches the P1 product direction and avoids creating low-value notes from every short exchange.

Alternative considered: automatically save a summary on panel close. This is rejected for P1 because it would create noisy private notes and make cancellation ambiguous.

### 2. Use a dedicated dialogue-summary workflow

Add a small server-side AI workflow, for example `lib/ai/dialogue-summary-workflow.ts`, with explicit inputs for reading context and conversation turns and outputs for structured summary fields. The workflow can use LangGraph with nodes for input validation, prompt assembly, model generation, and output normalization.

Alternative considered: reuse the selection answer workflow. This is rejected because selection answering includes retrieval, citations, memory, and answer-specific behavior that are unrelated to summarizing an existing conversation.

### 3. Preserve the existing personal note surface, extend source typing

The saved result should become a `personal_notes` row using a new source type such as `dialogue_summary`. The row should store user-editable summary text in `note_content`, selected/original text in `source_text` or `paragraph_excerpt`, and the structured summary plus conversation reference in `metadata`.

If the implementation needs a normalized `dialogue_summaries` table for stable original-conversation links, it should still save or expose the confirmed summary through the existing personal-notes API and UI so the user has one private notes surface.

### 4. Store bounded conversation reference data

The original conversation link should not require retaining unlimited raw chat history. A stable conversation reference can be derived from the current thread key and persisted with bounded turn snapshots in metadata or a separate `dialogue_summaries` record. The return path should restore enough context to show the original selected text and conversation summary/turns; if full restoration is unavailable, the note should still open the original paragraph and show a clear unavailable state for the dialogue.

### 5. Keep cancellation and failure non-destructive

Cancelling the confirmation dialog or failing generation must not create a note. Save failures must leave the draft visible so the user can retry or copy/edit within the app surface.

## Risks / Trade-offs

- [Risk] The summary model may invent claims not present in the conversation. -> Mitigation: prompt the workflow to summarize only supplied turns and reading context, and normalize missing fields instead of fabricating them.
- [Risk] Conversation metadata could grow too large. -> Mitigation: store bounded recent turns, compact fields, and enforce payload size limits before writing notes.
- [Risk] A user may navigate away before saving. -> Mitigation: generated drafts remain client-local until explicit save; unsaved drafts are not promised as durable.
- [Risk] Source context may be deleted after note creation. -> Mitigation: reuse existing note source-unavailable behavior and keep the saved summary readable.
- [Risk] Mobile confirmation UI could cover too much of the reader. -> Mitigation: use a compact modal or sheet with clear save/cancel actions and scrollable draft content.
