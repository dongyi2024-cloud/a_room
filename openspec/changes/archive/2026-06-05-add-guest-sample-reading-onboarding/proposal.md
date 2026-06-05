## Why

New visitors currently hit login before they can understand the product's core reading interaction. This creates friction before users see why selecting text and asking Woolf is valuable, and the post-upload flow does not clearly tell users what to do after an EPUB has been parsed.

## What Changes

- Add a guest-accessible sample reading path using the local sample book `epub/output/生死场_萧红小说精选集_萧红_z-library.sk_1lib.sk_z-lib.sk.json`.
- Show the sample book on the unauthenticated first page as `生死场` by `萧红`, without exposing source-file suffixes or download-source labels in the UI.
- Allow unauthenticated users to open the sample reader and read the sample content.
- Add first-run reader guidance that tells users to select text to reveal the Ask Woolf entry.
- Keep private actions login-gated: EPUB upload, personal bookshelf, private uploaded books, saved notes, persisted account reading progress, reflections, and real private-book AI calls.
- Show a login/register modal or equivalent login-required overlay when an unauthenticated user clicks the upload EPUB action.
- After login, return the user to the upload entry so they can continue the intended action.
- After a logged-in EPUB upload and parsing flow completes, guide the user into the next action: start reading the uploaded book and try selecting text.
- No breaking changes to authenticated bookshelf, ingestion, RAG, or selected-text AI contracts.

## Capabilities

### New Capabilities
- `guest-sample-reading-onboarding`: Covers unauthenticated sample-book discovery, sample-reader entry, first-run selection guidance, login-gated upload prompting, and post-upload next-step guidance.

### Modified Capabilities
- `bookshelf`: Clarifies that personal bookshelf and EPUB upload remain authenticated, while unauthenticated upload attempts from public surfaces enter a login-required overlay and resume path.
- `basic-reader`: Extends reader access so a public sample reader can render bundled sample content without granting access to private user books.

## Impact

- Affected pages/components: `app/page.tsx`, `app/reader/[bookId]/page.tsx` or a dedicated sample-reader route, `components/workbench/home-workbench.tsx`, `components/bookshelf/book-upload-control.tsx`, `components/reader/reader-shell.tsx`, and shared login-required UI.
- Affected data loading: add a sample-book loader for the converted `生死场` JSON output or a build-time/public sample representation derived from it.
- Affected auth behavior: keep existing server-side auth requirements for `/bookshelf`, private `/reader/[bookId]`, and upload/process APIs; add a client-facing login-required prompt before unauthenticated upload attempts.
- Affected UX state: add local first-run guidance state for the sample/private reader selection hint, and upload-success guidance for logged-in ingestion completion.
- No new AI provider, LangGraph workflow, database table, or API key dependency is required for this change.
