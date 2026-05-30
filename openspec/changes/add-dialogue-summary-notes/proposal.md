## Why

F12 has made useful AI answers, selected text, smart mark explanations, and reflections saveable as private notes, but a multi-turn AI conversation can still disappear as an interaction rather than becoming reviewable reading material. F15 adds an explicit summary step so readers can preserve the shape of a finished conversation without storing every turn as a note automatically.

## What Changes

- Add a dialogue-summary capability for generating a structured summary from an eligible AI conversation.
- Require the summary to include the user's core question, AI answer points, related original text/context, and optional follow-up questions when available.
- Use a "system generates, user reviews, user confirms save" flow in P1 so summaries are not silently saved.
- Allow the generated summary to be edited before saving.
- Persist the saved summary as a private personal note bound to the current user, book, chapter, paragraph, and original conversation reference.
- Add a path from the saved note back to the original conversation when that conversation is still available.
- Keep cancellation non-destructive: no note is created when the user cancels or closes the confirmation flow.

## Capabilities

### New Capabilities

- `dialogue-summary-notes`: Covers generating, reviewing, editing, confirming, saving, and reopening summaries for paragraph-bound AI conversations.

### Modified Capabilities

- `personal-notes`: Extends private personal notes to support dialogue-summary notes and an original-conversation return path.

## Impact

- AI workflow: adds a bounded summarization path for existing AI conversation turns, preferably through a small LangGraph summarization node because this is AI orchestration over conversation state.
- Data model: may add a `dialogue_summaries` table or extend `personal_notes` metadata/source typing to store summary content and conversation references.
- API: adds server-side endpoints or actions for generating a draft summary and saving the confirmed version as a note.
- UI: updates the AI dialogue surface with a "生成摘要" action, editable confirmation UI, cancel/save states, and personal-note display links.
- Privacy and access control: summary generation and saved summaries must validate the current user, book ownership, chapter/paragraph membership, and note ownership.
