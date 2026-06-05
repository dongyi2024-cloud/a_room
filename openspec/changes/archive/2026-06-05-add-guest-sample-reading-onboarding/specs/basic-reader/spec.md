## MODIFIED Requirements

### Requirement: User can enter the reader for a selected book
The system SHALL provide a reader route for a ready book in the logged-in user's personal bookshelf, and it MUST return a non-broken unavailable state when the requested book does not exist, is not owned by the current user, or has not completed ingestion successfully. The system SHALL also provide a bounded public reader path for the configured sample book without granting unauthenticated access to private bookshelf books.

#### Scenario: Open reader from bookshelf
- **WHEN** a logged-in user selects a ready book in the personal bookshelf
- **THEN** the system opens the reader route for that exact book context

#### Scenario: Reader route receives an unknown or unreadable book
- **WHEN** the reader is opened with a book identifier that does not exist, is not accessible to the current user, or is still processing or failed
- **THEN** the system shows a non-broken unavailable state instead of rendering a blank or corrupted reader

#### Scenario: Guest opens configured sample reader
- **WHEN** an unauthenticated visitor opens the configured sample-book reader path
- **THEN** the system renders the public sample book content without redirecting to login

#### Scenario: Guest cannot open private reader by arbitrary id
- **WHEN** an unauthenticated visitor opens a private uploaded-book reader path or an unknown reader id
- **THEN** the system does not render private book content and uses the login-required or unavailable path
