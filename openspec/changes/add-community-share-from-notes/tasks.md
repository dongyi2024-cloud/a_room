## 1. Data And Types

- [x] 1.1 Inspect existing `personal_notes`, `reflection_cards`, and reflection APIs to choose whether source-note linkage needs new optional columns or metadata.
- [x] 1.2 Update Supabase schema and generated TypeScript database types if reflection cards need source-note/source-type fields.
- [x] 1.3 Add request/response types for generating and publishing note-share drafts.

## 2. Server Logic

- [x] 2.1 Add a helper that loads an owned personal note and validates its book, chapter, and paragraph context.
- [x] 2.2 Add deterministic share-draft generation from supported note source types without copying full dialogue metadata.
- [x] 2.3 Add a note-share publish API that accepts `noteId` plus edited public content and rejects unauthenticated, cross-user, invalid-context, empty, or overlong requests.
- [x] 2.4 Reuse or extend the reflection-card creation path so confirmed note shares appear as normal paragraph-bound community cards.

## 3. Notes Page UX

- [x] 3.1 Add a restrained “分享到社区” entry on eligible note cards in the personal notes page.
- [x] 3.2 Add the review/edit/cancel/confirm flow with related book, chapter, and paragraph context.
- [x] 3.3 Add loading, success, and failure states that keep the private note visible when publishing fails.
- [x] 3.4 Ensure dialogue-summary notes share only reviewed summary text by default and do not expose raw dialogue turns.

## 4. Community Feed Integration

- [x] 4.1 Ensure note-share cards appear in the aggregate `/community` feed with existing card fields and interactions.
- [x] 4.2 Ensure note-share cards appear in the source paragraph reflection feed.
- [x] 4.3 Verify the community feed does not expose private source-note metadata or hidden dialogue history.

## 5. Tests And Validation

- [x] 5.1 Add tests or source checks for share draft generation across `dialogue_summary`, `selected_text`, `ai_answer`, `smart_mark_explanation`, and `reflection` notes.
- [x] 5.2 Add tests for authentication, note ownership, invalid context, cancel behavior, and publish failure handling.
- [x] 5.3 Add tests or source checks confirming published shares use existing reflection-card rendering and do not create context-free posts.
- [x] 5.4 Run `npm run test:personal-notes` and any new note-share/community test script.
- [x] 5.5 Run `npx tsc --noEmit`.
- [x] 5.6 Run `npm run build`.
- [x] 5.7 Run `openspec validate add-community-share-from-notes --strict`.
- [x] 5.8 Manually verify the flow on PC and mobile: share note, share dialogue summary, edit before publish, cancel, view in community feed, and confirm full dialogue is not exposed by default.
