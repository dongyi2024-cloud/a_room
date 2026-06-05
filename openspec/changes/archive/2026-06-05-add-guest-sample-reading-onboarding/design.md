## Context

The current app is built around authenticated use: `/`, `/bookshelf`, private reader routes, upload initiation, and processing all require a Supabase user. That protects private books and user-bound data, but it means a new visitor sees login before they can experience the core product gesture: reading, selecting text, and discovering Ask Woolf.

This change introduces a bounded guest path. Guests may read one bundled sample book, `生死场` by `萧红`, sourced from the existing converted JSON output under `epub/output/`. Guest access must not create private bookshelf rows, upload records, reading-event rows, notes, reflections, memory records, or private AI requests.

## Goals / Non-Goals

**Goals:**
- Let unauthenticated visitors see a real homepage entry for the sample book and open a sample reader.
- Use the local `生死场` converted JSON as the sample-book content source while showing clean public metadata in the UI.
- Teach the reader interaction through a lightweight first-run hint that asks users to select text.
- Gate EPUB upload behind a login/register prompt when clicked from a public surface.
- Return users to the upload entry after successful login.
- After a logged-in upload completes parsing, make the next step explicit: start reading the uploaded book and try selecting text.

**Non-Goals:**
- Do not allow anonymous EPUB uploads.
- Do not add anonymous database ownership, temporary user migration, or post-login claim flows.
- Do not add a public book catalog beyond the single sample book.
- Do not add a new AI workflow or change LangGraph selection-answer orchestration.
- Do not expose `z-library`, `1lib`, source file names, or download provenance in the public UI.

## Decisions

### 1. Use a dedicated sample-book identity instead of private `book_id`

The sample book should have a stable public identifier such as `sample-sheng-si-chang` and load from bundled/static sample content. The private `/reader/[bookId]` route can remain owner-scoped; implementation may either add a dedicated sample route or explicitly branch only for the known sample id before requiring a user.

Alternatives considered:
- Insert the sample into Supabase as a shared public book. Rejected for this change because it complicates RLS, ownership rules, and bookshelf semantics.
- Let guests upload and claim books after login. Rejected because it adds temporary ownership, cleanup, and privacy risk before the onboarding problem is solved.

### 2. Treat sample reading as read-only product demonstration

Guest sample reading may render the same reader shell where practical, but all user-bound actions must either be hidden, disabled with a login prompt, or routed through the login-required overlay. This includes upload, note saving, reflection publishing, account reading-progress persistence, and private-book AI requests.

Alternatives considered:
- Fully duplicate a separate static sample reader UI. Rejected unless the shared reader shell proves too coupled, because duplicated reading behavior would drift from the real product.
- Let guest progress save to the server. Rejected because server writes require a user identity.

### 3. Keep upload APIs authenticated

The existing upload initiation and processing APIs should continue returning 401 when no user is present. Public upload buttons should intercept unauthenticated clicks before file selection and show a login/register prompt with a `next` path back to the upload entry.

Alternatives considered:
- Let the API response trigger login after the file is selected. Rejected because it wastes the user's file-picking action and can lose browser file handles after navigation.

### 4. Implement first-run guidance as local UI state

The select-text hint should appear on first sample/private reader entry until the user selects text or dismisses it. Local storage is sufficient for guest state; authenticated users may also use local storage for this presentation hint because it is not critical product data.

Alternatives considered:
- Persist onboarding state to Supabase user preferences. Rejected for the first version because the hint is low-stakes and should also work for guests.

### 5. Post-upload guidance belongs next to upload completion

When processing returns a ready book id, the upload surface should offer an explicit `开始阅读` action targeting that book and mention selecting text in the reader. If RAG/AI preparation is still processing but the book is readable, the reading CTA should remain available while AI readiness is described separately.

Alternatives considered:
- Automatically redirect immediately after upload. This may be acceptable on a dedicated upload flow, but a visible CTA is less surprising on the current homepage/workbench upload surface.

## Risks / Trade-offs

- Public sample content copyright/provenance risk -> Do not expose source-file provenance in UI; before production launch, confirm the sample text is acceptable for public use or replace the sample source with a cleared excerpt.
- Shared reader shell may assume `readerUserId` exists -> Keep guest-specific branches narrow and disable user-bound actions when no authenticated user exists.
- Users may expect full AI in guest mode -> The sample reader must make login-gated actions clear and avoid broken private API calls.
- Sample JSON shape may differ from `ReaderBookDetail` -> Add a small loader/mapper that converts the existing JSON output into the reader's structured book type.
- Login modal can trap users on mobile -> Ensure the prompt has a clear close action and a full-page login fallback.
