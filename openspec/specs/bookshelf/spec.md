## Purpose

Define the authenticated personal bookshelf surface, including owner-scoped book listing, EPUB upload/import status, and reader entry for ready books.
## Requirements
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

### Requirement: Bookshelf lists only the current user's books
The system SHALL show only the books that belong to the current user's personal bookshelf, and it MUST isolate bookshelf contents between different users.

#### Scenario: User sees own bookshelf items
- **WHEN** a logged-in user has one or more books in their bookshelf
- **THEN** the system lists those books in that user's bookshelf view

#### Scenario: Different users have separate bookshelves
- **WHEN** two different logged-in users each add books to their bookshelves
- **THEN** each user sees only their own bookshelf items and cannot see or operate on the other user's items

### Requirement: Bookshelf provides empty state and add-book entry
The system SHALL show a readable empty state when the current user has no books, and it SHALL provide an add/upload entry from both empty and non-empty bookshelf states.

#### Scenario: Empty bookshelf shows upload entry
- **WHEN** the current user has no books in their bookshelf
- **THEN** the system shows an empty state with a clear upload or add-book call to action

#### Scenario: Non-empty bookshelf still allows adding books
- **WHEN** the current user already has one or more books in their bookshelf
- **THEN** the system still shows a visible entry for uploading or adding another book

### Requirement: User can upload an EPUB book into the bookshelf import flow
The system SHALL allow a logged-in user to upload a supported EPUB file from the bookshelf page, create a private import record for that file, store the source file in private storage, and associate the resulting book with that user's bookshelf.

#### Scenario: Successful EPUB upload starts private import
- **WHEN** a logged-in user selects a valid EPUB file from the bookshelf page
- **THEN** the system accepts the upload, creates an owner-scoped book import record, stores the source file in the private book-files bucket, and shows that the book is being processed for that user

#### Scenario: Unsupported file type is rejected
- **WHEN** a logged-in user attempts to upload a file that is not supported by the current ingestion flow
- **THEN** the system rejects the upload and shows a recoverable validation error without creating a readable bookshelf entry

### Requirement: Bookshelf exposes import status until a book becomes readable
The system SHALL represent each uploaded book's persisted import status in the bookshelf, and only books whose parsed structure finished successfully SHALL become reader-accessible entries for that same user.

#### Scenario: Uploaded book is still processing
- **WHEN** an uploaded book has not finished parsing and persistence yet
- **THEN** the system shows the bookshelf item as processing and does not allow entry into the reader

#### Scenario: Uploaded book finishes parsing
- **WHEN** an uploaded book is successfully persisted into book, chapter, and paragraph records
- **THEN** the system marks the bookshelf item as ready and allows the user to enter the reader for that exact book

#### Scenario: Uploaded book fails parsing
- **WHEN** an uploaded book cannot be parsed or persisted successfully
- **THEN** the system shows a failed state and recoverable error for that bookshelf item without breaking the rest of the bookshelf page

### Requirement: User can open a ready book from the bookshelf into the reader
The system SHALL allow a logged-in user to open a ready bookshelf book into `/reader/[bookId]`, and it MUST prevent navigation into unreadable bookshelf items.

#### Scenario: Open ready book from bookshelf
- **WHEN** the current user selects a bookshelf item whose import status is ready
- **THEN** the system opens the reader for that exact book

#### Scenario: Select unreadable bookshelf item
- **WHEN** the current user selects a bookshelf item whose import status is still processing or failed
- **THEN** the system prevents reader entry and keeps the user in a non-broken bookshelf flow

### Requirement: Bookshelf exposes reading preferences entry
The system SHALL provide a visible entry from the authenticated bookshelf area to the reading preferences settings page.

#### Scenario: Logged-in user opens bookshelf
- **WHEN** a logged-in user opens `/bookshelf`
- **THEN** the bookshelf page includes an entry for reading preferences

#### Scenario: User selects reading preferences entry
- **WHEN** a logged-in user activates the reading preferences entry from the bookshelf page
- **THEN** the system opens the reading preferences settings page

#### Scenario: Mobile bookshelf shows preferences entry
- **WHEN** the bookshelf page is viewed on a mobile viewport
- **THEN** the reading preferences entry remains visible and tappable without crowding the primary reading actions
