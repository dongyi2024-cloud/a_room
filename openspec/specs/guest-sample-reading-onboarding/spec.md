## Purpose

Define unauthenticated sample-book discovery, sample-reader entry, first-run selection guidance, login-gated upload prompting, and post-upload next-step guidance.

## Requirements

### Requirement: Public homepage exposes a sample reading entry
The system SHALL show an unauthenticated public entry for the sample book `生死场` by `萧红`, and it MUST NOT expose source-file suffixes, download-source labels, or storage implementation details in the public UI.

#### Scenario: Guest sees sample book
- **WHEN** an unauthenticated visitor opens the public first page
- **THEN** the page shows a sample book entry titled `生死场` with author `萧红`
- **AND** the entry can be opened without requiring login

#### Scenario: Public metadata is clean
- **WHEN** the sample book entry or sample reader metadata is rendered
- **THEN** the UI does not show `z-library`, `1lib`, raw EPUB file names, local file paths, or converted JSON file names

### Requirement: Guest can read the sample book
The system SHALL allow unauthenticated visitors to open and read the bundled `生死场` sample book as read-only sample content.

#### Scenario: Guest opens sample reader
- **WHEN** an unauthenticated visitor activates the `生死场` sample book entry
- **THEN** the system opens a sample reader without redirecting to login
- **AND** the reader displays ordered chapter and paragraph content from the bundled sample source

#### Scenario: Sample reader does not grant private book access
- **WHEN** an unauthenticated visitor opens the sample reader
- **THEN** the system does not expose personal bookshelf content, private uploaded books, private notes, private reading progress, memories, reflections, or another user's data

### Requirement: Reader provides first-run selection guidance
The system SHALL show a lightweight first-run reader hint that tells users they can select text to reveal Ask Woolf and related reading actions.

#### Scenario: Guest sees selection hint
- **WHEN** an unauthenticated visitor opens the sample reader for the first time on a device
- **THEN** the reader shows a concise hint instructing the visitor to select a sentence or passage

#### Scenario: Hint clears after selection
- **WHEN** the reader successfully detects a text selection that can reveal the reader action entry
- **THEN** the first-run selection hint is dismissed or suppressed for that device

#### Scenario: Hint is usable on mobile
- **WHEN** the sample reader is opened on a mobile viewport
- **THEN** the selection hint remains readable and does not block chapter text, navigation, or the selection gesture

### Requirement: Guest upload attempts require login before file selection
The system SHALL intercept unauthenticated EPUB upload attempts from public surfaces and show a login/register prompt before opening the file picker.

#### Scenario: Guest clicks upload EPUB
- **WHEN** an unauthenticated visitor clicks an upload EPUB action
- **THEN** the system shows a login/register prompt instead of opening the file picker
- **AND** the prompt explains that upload requires an account

#### Scenario: Login resumes upload intent
- **WHEN** the visitor signs in or registers from the upload-required prompt
- **THEN** the system returns the user to the upload entry or an equivalent page where the EPUB upload action is immediately available

### Requirement: Uploaded book completion guides the next action
The system SHALL provide explicit next-step guidance after a logged-in EPUB upload finishes parsing enough to become readable.

#### Scenario: Uploaded book becomes readable
- **WHEN** a logged-in user's EPUB upload and parsing flow completes with a readable book id
- **THEN** the upload surface shows a `开始阅读` action for that uploaded book
- **AND** it tells the user they can select text in the reader to ask Woolf

#### Scenario: AI preparation lags behind reading readiness
- **WHEN** a logged-in user's EPUB is readable but AI/RAG preparation is still processing or has failed
- **THEN** the system still offers the reading entry
- **AND** it communicates the AI preparation state separately without blocking basic reading
