## 1. Data Model and Types

- [x] 1.1 Extend personal note source typing to include `dialogue_summary` in schema, Supabase types, and app-level note types.
- [x] 1.2 Add storage for dialogue summary metadata, including conversation reference, selected/source text, structured summary fields, and bounded turn snapshots or a normalized dialogue summary record.
- [x] 1.3 Ensure database constraints, indexes, and RLS preserve user ownership for dialogue-summary notes and any dialogue-summary records.
- [x] 1.4 Update note validation helpers to accept dialogue summaries only when book, chapter, paragraph, and user ownership are valid.

## 2. Summary Generation Workflow

- [x] 2.1 Add a dedicated dialogue-summary AI workflow module using LangGraph with validation, prompt assembly, model generation, and output normalization nodes.
- [x] 2.2 Define request/response types for summary drafts, including core questions, answer points, related source text, follow-up questions, and editable summary text.
- [x] 2.3 Keep the workflow grounded to supplied reading context and conversation turns, with safe fallback errors for invalid or unsupported input.
- [x] 2.4 Add a server endpoint or action to generate a draft summary without creating a note.

## 3. Save and Retrieval APIs

- [x] 3.1 Add or extend an API route to save a confirmed dialogue summary as a personal note after user edits.
- [x] 3.2 Persist the original conversation reference and bounded context needed to reopen or display the source dialogue.
- [x] 3.3 Ensure unauthenticated, cross-user, invalid book, invalid chapter, and invalid paragraph requests are rejected without leaking private content.
- [x] 3.4 Ensure cancelled summary flows do not create notes or durable summary records.

## 4. Reader UI

- [x] 4.1 Add a "生成摘要" entry to eligible selected-text AI dialogue surfaces after at least one completed AI answer.
- [x] 4.2 Build an editable review UI for the generated summary with clear save and cancel actions.
- [x] 4.3 Show generation, saving, success, failure, and duplicate-submit prevention states.
- [x] 4.4 Make the flow usable on desktop and mobile without permanently covering the reader content.

## 5. Notes UI and Original Dialogue Return

- [x] 5.1 Update the personal notes page to label and render dialogue-summary notes with summary content and source context.
- [x] 5.2 Add a return action from dialogue-summary notes to the original dialogue context when available.
- [x] 5.3 Show a bounded unavailable state when the original dialogue cannot be restored while keeping the saved summary readable.
- [x] 5.4 Preserve existing book-card grouping and existing rendering behavior for non-dialogue-summary note types.

## 6. Tests and Validation

- [x] 6.1 Add tests or source checks for generating a draft summary without creating a note.
- [x] 6.2 Add tests for editing and confirming a summary and saving the edited content as a `dialogue_summary` personal note.
- [x] 6.3 Add tests for cancelling without persistence.
- [x] 6.4 Add tests for authentication, cross-user rejection, and invalid context rejection.
- [x] 6.5 Add tests or source checks for note list rendering, original-dialogue links, and unavailable dialogue state.
- [x] 6.6 Run `npx tsc --noEmit`, relevant feature tests, `npm run build`, and `openspec validate add-dialogue-summary-notes --strict`.
