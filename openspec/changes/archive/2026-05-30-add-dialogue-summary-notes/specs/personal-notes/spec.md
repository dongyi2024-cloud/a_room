## ADDED Requirements

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
