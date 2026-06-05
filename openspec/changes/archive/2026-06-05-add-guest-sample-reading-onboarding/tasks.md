## 1. Sample Book Data

- [x] 1.1 Inspect the converted `生死场` JSON shape and define a stable sample-book id such as `sample-sheng-si-chang`.
- [x] 1.2 Add a sample-book loader or static data module that maps the converted JSON into the reader's structured book detail type.
- [x] 1.3 Ensure public sample metadata displays only clean title/author fields and never exposes raw file names, local paths, or source labels.

## 2. Public Entry And Sample Reader

- [x] 2.1 Update the unauthenticated first page so visitors can see and open the `生死场` sample book without login.
- [x] 2.2 Add or adapt a sample reader route that renders the sample book without bypassing private-book ownership checks for arbitrary book ids.
- [x] 2.3 Disable, hide, or login-gate user-bound actions in the guest sample reader, including notes, reflections, account progress, private AI calls, and upload.
- [x] 2.4 Preserve authenticated homepage, bookshelf, and private reader behavior for logged-in users.

## 3. Selection Onboarding

- [x] 3.1 Add a first-run reader hint that tells users to select a sentence or passage to reveal Ask Woolf.
- [x] 3.2 Dismiss or suppress the hint after the reader detects a valid selectable text interaction or the user dismisses it.
- [x] 3.3 Verify the hint is readable and non-blocking on both PC and mobile reader layouts.

## 4. Login-Gated Upload Flow

- [x] 4.1 Add an unauthenticated upload click path that shows a login/register prompt before the file picker opens.
- [x] 4.2 Preserve a `next` or resume target so successful login returns the user to an upload-ready page.
- [x] 4.3 Keep upload initiation and book processing APIs authenticated and verify unauthenticated API requests still return a bounded login-required error.

## 5. Post-Upload Guidance

- [x] 5.1 Update the logged-in upload completion state to expose a `开始阅读` action for the processed book when it is readable.
- [x] 5.2 Show concise guidance after upload completion that the user can select text in the reader to ask Woolf.
- [x] 5.3 Keep reading available when AI/RAG preparation is still processing or failed, while communicating that AI readiness separately.

## 6. Verification

- [x] 6.1 Run typecheck/lint or the repo's available validation command for the changed frontend and data-loading code.
- [x] 6.2 Manually verify unauthenticated desktop flow: public page -> sample book -> sample reader -> selection hint -> upload login prompt.
- [x] 6.3 Manually verify unauthenticated mobile flow: sample reader is readable, hint does not block selection, upload prompts login.
- [x] 6.4 Manually verify authenticated upload flow: upload EPUB -> parsing completion -> `开始阅读` action -> reader opens the uploaded book.
- [x] 6.5 Verify private data boundaries: guests cannot open arbitrary private reader ids, create bookshelf items, save notes, or trigger private-book AI calls.
