## Purpose

Define the core reader route, structured book rendering, chapter navigation, responsive reading layout, and public sample-reader boundary.

## Requirements

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

### Requirement: Reader displays structured book content
The system SHALL render the selected ready book using persisted parsed chapter and paragraph records from storage, and it SHALL display the book title, current chapter title, and chapter paragraphs in their stored order.

#### Scenario: Render current chapter content
- **WHEN** the reader loads a valid ready book with persisted parsed chapters and paragraphs
- **THEN** the system displays the book title, chapter title, and paragraph content in sequence

#### Scenario: Book has no readable chapter content
- **WHEN** the selected ready book has no available parsed chapter or paragraph content
- **THEN** the system shows a readable empty state and does not render corrupted content

### Requirement: Reader supports chapter-level navigation
The system SHALL allow the user to move between chapters of the same book from within the reader, and this navigation MUST be available both above and below the chapter body.

#### Scenario: Move to next chapter from top navigation
- **WHEN** the current chapter is not the last chapter and the user requests the next chapter from the top navigation
- **THEN** the system loads the next chapter's title and paragraphs

#### Scenario: Move to previous chapter from top navigation
- **WHEN** the current chapter is not the first chapter and the user requests the previous chapter from the top navigation
- **THEN** the system loads the previous chapter's title and paragraphs

#### Scenario: Move to next chapter from bottom navigation
- **WHEN** the current chapter is not the last chapter and the user reaches the end of the chapter and requests the next chapter from the bottom navigation
- **THEN** the system loads the next chapter's title and paragraphs

#### Scenario: Move to previous chapter from bottom navigation
- **WHEN** the current chapter is not the first chapter and the user reaches the end of the chapter and requests the previous chapter from the bottom navigation
- **THEN** the system loads the previous chapter's title and paragraphs

### Requirement: Reader supports continuous reading layout on PC and mobile
The system SHALL present chapter content in a readable continuous-scrolling layout on both PC and mobile interfaces.

#### Scenario: Read on desktop
- **WHEN** the user opens the reader on a desktop viewport
- **THEN** the system displays a centered and readable text layout suitable for long-form reading

#### Scenario: Read on mobile
- **WHEN** the user opens the reader on a mobile viewport
- **THEN** the system displays a readable text layout without relying on hover interactions

### Requirement: Reader remains stable across refresh and reload
The system SHALL preserve the ability to render the current book and chapter after page refresh as long as the underlying parsed content remains available.

#### Scenario: Refresh current reader page
- **WHEN** the user refreshes the reader page for a valid book and chapter
- **THEN** the system reloads the same reader context without showing a blank page or losing the available text content
