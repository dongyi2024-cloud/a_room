## Purpose

Define how readers save AI answers, smart mark explanations, selected text, and reading reflections as private paragraph-bound personal notes.

## Requirements

### Requirement: Users can save supported reading surfaces as personal notes
The system SHALL let a logged-in reader save an AI answer, smart mark explanation, selected text, or reading reflection as a private personal note when the source has enough reading context.

#### Scenario: Save AI answer from reader panel
- **WHEN** a logged-in user activates “加入笔记” below a selected-text AI answer that is bound to a book, chapter, and paragraph
- **THEN** the system creates a personal note containing the source text or selected text, the saved AI answer, the book id, chapter id, paragraph id, user id, and creation time

#### Scenario: Save smart mark explanation
- **WHEN** a logged-in user activates “加入笔记” from a smart mark explanation
- **THEN** the system creates a personal note containing the marked text, the explanation, the book id, chapter id, paragraph id, user id, and creation time

#### Scenario: Save selected text without AI answer
- **WHEN** a logged-in user saves selected text from the reader action menu
- **THEN** the system creates a personal note containing the selected text, reading context, user id, and creation time

#### Scenario: Save reflection as note
- **WHEN** a logged-in user saves a reading reflection as a personal note
- **THEN** the system creates a private personal note without publishing or modifying the community reflection feed

### Requirement: Personal note creation MUST validate authentication and reading ownership
The system MUST reject note creation unless the current user is authenticated and owns the referenced book context.

#### Scenario: Unauthenticated save is rejected
- **WHEN** an unauthenticated user attempts to save a personal note
- **THEN** the system rejects the request and does not create a note

#### Scenario: Cross-user book save is rejected
- **WHEN** a logged-in user attempts to save a note for a book owned by another user
- **THEN** the system rejects the request and does not create a note

#### Scenario: Invalid paragraph binding is rejected
- **WHEN** a save request references a chapter or paragraph that does not belong to the referenced book
- **THEN** the system rejects the request and does not create a note

### Requirement: Personal notes SHALL remain private to their owner
The system SHALL ensure users can only list, view, create, or navigate from their own personal notes.

#### Scenario: User lists personal notes
- **WHEN** a logged-in user opens the personal note list
- **THEN** the system shows only notes whose `user_id` matches the current user

#### Scenario: Other user's note is not visible
- **WHEN** a logged-in user requests or navigates to a note owned by another user
- **THEN** the system does not reveal that note's content or reading context

#### Scenario: Notes are isolated by database policy
- **WHEN** database row-level security evaluates personal note access
- **THEN** read and write access is limited to rows owned by the authenticated user

### Requirement: Personal center SHALL show saved notes with reading context
The system SHALL provide a personal-center note view where a logged-in user can review saved notes and their source context.

#### Scenario: Note list shows saved fields
- **WHEN** a logged-in user opens the personal note view
- **THEN** each note shows the saved content or explanation, source type, related book, related chapter, paragraph excerpt or selected text, and creation time

#### Scenario: Empty note list
- **WHEN** a logged-in user has no saved notes
- **THEN** the personal note view shows a clear empty state instead of a broken or blank list

#### Scenario: Note list loading failure
- **WHEN** notes cannot be loaded due to an application or network error
- **THEN** the personal note view shows a bounded failure message and keeps the rest of the application usable

### Requirement: Personal notes SHALL link back to the original paragraph
The system SHALL let users return from a personal note to the original book, chapter, and paragraph location in the reader.

#### Scenario: Open source from note
- **WHEN** a user activates the return-to-source action on one of their notes
- **THEN** the system opens the corresponding reader page and scrolls or jumps to the saved paragraph

#### Scenario: Deleted book source is unavailable
- **WHEN** a saved note references a book or paragraph that is no longer available to the user
- **THEN** the system does not crash and shows that the original source is unavailable

### Requirement: Note saving SHALL provide safe interaction states on desktop and mobile
The system SHALL show clear saving, saved, and failed states for note actions on both desktop and mobile reader surfaces.

#### Scenario: Save action shows progress
- **WHEN** a user activates “加入笔记”
- **THEN** the action indicates that saving is in progress and prevents duplicate submissions until the request finishes

#### Scenario: Save succeeds
- **WHEN** the personal note is saved successfully
- **THEN** the surface confirms that the note was saved

#### Scenario: Save fails
- **WHEN** the personal note cannot be saved
- **THEN** the surface shows a clear failure message and does not claim that the note was saved

#### Scenario: Desktop and mobile save flows are usable
- **WHEN** the note action appears in supported desktop or mobile reader surfaces
- **THEN** the action remains readable, reachable, and usable without blocking the reader content

### Requirement: Personal notes SHALL support dialogue summary notes
The system SHALL let a confirmed dialogue summary be saved and displayed as a private personal note source type.

#### Scenario: Save confirmed dialogue summary as note
- **WHEN** a logged-in user confirms saving an edited dialogue summary that is bound to a book, chapter, and paragraph
- **THEN** the system creates a private personal note with source type `dialogue_summary`, the summary content, source text or paragraph excerpt, user id, book id, chapter id, paragraph id, conversation reference, and creation time

#### Scenario: Dialogue summary note appears in personal notes
- **WHEN** a logged-in user opens the personal note view for a book that has saved dialogue summaries
- **THEN** the dialogue summary notes appear with a dialogue-summary label, summary content, related book, related chapter, source context, and creation time

### Requirement: Personal notes SHALL link dialogue summaries back to their original dialogue
The system SHALL provide a return action from a dialogue-summary personal note to the original dialogue context when that context is available.

#### Scenario: Open original dialogue from note
- **WHEN** a user activates the original-dialogue action on one of their dialogue-summary notes
- **THEN** the system opens the related reader paragraph and restores or displays the referenced AI dialogue context

#### Scenario: Original dialogue link unavailable
- **WHEN** a dialogue-summary note references a dialogue context that can no longer be restored
- **THEN** the personal note view still shows the saved summary and indicates that the original dialogue is unavailable

### Requirement: Dialogue summary notes MUST remain private to their owner
The system MUST apply the same ownership and privacy protections to dialogue-summary notes as other personal notes.

#### Scenario: User sees only own dialogue summary notes
- **WHEN** a logged-in user opens the personal note view
- **THEN** the system shows only dialogue-summary notes whose `user_id` matches the current user

#### Scenario: Cross-user dialogue summary note access is rejected
- **WHEN** a logged-in user requests or navigates to another user's dialogue-summary note or original dialogue reference
- **THEN** the system does not reveal that note, summary, source text, or dialogue context
