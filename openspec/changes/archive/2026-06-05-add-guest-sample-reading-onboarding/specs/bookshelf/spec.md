## MODIFIED Requirements

### Requirement: Bookshelf is the authenticated personal entry page for reading
The system SHALL provide `/bookshelf` as the personal bookshelf page for the current logged-in user, and unauthenticated users MUST NOT enter an interactive personal bookshelf flow. Public surfaces MAY show an upload EPUB action to unauthenticated visitors, but activating that action MUST enter a login-required prompt rather than the personal bookshelf upload flow or the file picker.

#### Scenario: Logged-in user opens bookshelf
- **WHEN** a logged-in user opens `/bookshelf`
- **THEN** the system shows that user's personal bookshelf and available bookshelf actions

#### Scenario: Unauthenticated user opens bookshelf
- **WHEN** a user without a valid login session opens `/bookshelf`
- **THEN** the system blocks access to the interactive bookshelf flow and directs the user into the login-required path

#### Scenario: Unauthenticated visitor clicks public upload action
- **WHEN** an unauthenticated visitor activates an upload EPUB action from a public page or sample reading surface
- **THEN** the system shows a login-required prompt before opening a file picker
- **AND** the user is not allowed to create a private bookshelf item until authenticated
