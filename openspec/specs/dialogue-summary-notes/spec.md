## Purpose

Define how readers generate, review, save, and revisit paragraph-bound AI dialogue summaries as private notes.

## Requirements

### Requirement: Users can generate a draft summary for an AI dialogue
The system SHALL let a logged-in user generate a draft summary for an eligible paragraph-bound AI dialogue.

#### Scenario: Generate summary from multi-turn selection dialogue
- **WHEN** a logged-in user activates "生成摘要" for an AI dialogue that has reading context and at least one completed user/AI exchange
- **THEN** the system returns a draft summary for that dialogue without creating a saved note

#### Scenario: Ineligible dialogue cannot be summarized
- **WHEN** a dialogue has no completed AI answer or lacks book, chapter, or paragraph context
- **THEN** the system does not generate a summary and explains that the dialogue cannot yet be summarized

### Requirement: Dialogue summaries MUST contain reviewable structured content
The system MUST generate a reviewable summary that is grounded in the supplied dialogue turns and reading context.

#### Scenario: Summary includes core fields
- **WHEN** a dialogue summary draft is generated
- **THEN** it includes the user's core question or questions, AI answer points, related original text or paragraph context, and optional follow-up questions when available

#### Scenario: Summary stays within provided conversation
- **WHEN** the summary workflow receives conversation turns and reading context
- **THEN** it summarizes only those supplied materials and does not add unsupported claims, citations, or external sources

### Requirement: Users can edit and confirm a dialogue summary before saving
The system SHALL let the user edit the generated summary draft and choose whether to save it.

#### Scenario: User edits and saves summary
- **WHEN** a user edits a generated summary draft and confirms saving
- **THEN** the system saves the edited version rather than the original unedited draft

#### Scenario: User cancels summary save
- **WHEN** a user cancels or closes the summary confirmation flow before saving
- **THEN** the system does not create a note or durable summary record

### Requirement: Dialogue summary generation MUST validate private reading context
The system MUST reject summary generation or saving unless the current user is authenticated and owns the referenced reading context.

#### Scenario: Unauthenticated summary request is rejected
- **WHEN** an unauthenticated user requests a dialogue summary
- **THEN** the system rejects the request and does not generate or save a summary

#### Scenario: Cross-user context is rejected
- **WHEN** a logged-in user requests or saves a dialogue summary for a book owned by another user
- **THEN** the system rejects the request and does not reveal the dialogue, source text, or note content

#### Scenario: Invalid paragraph context is rejected
- **WHEN** a summary request references a chapter or paragraph that does not belong to the referenced book
- **THEN** the system rejects the request and does not create a note

### Requirement: Saved dialogue summaries SHALL retain an original conversation reference
The system SHALL retain enough original conversation reference data for a saved dialogue summary to reconnect the user to the source dialogue context when available.

#### Scenario: Summary stores conversation reference
- **WHEN** a confirmed dialogue summary is saved
- **THEN** the saved record includes a conversation reference, book id, chapter id, paragraph id, selected or related source text, and creation time

#### Scenario: Original dialogue can be reopened
- **WHEN** a user opens the original dialogue action from a saved dialogue summary and the referenced context is still available
- **THEN** the system opens the reader at the related paragraph and restores or displays the referenced dialogue context

#### Scenario: Original dialogue is unavailable
- **WHEN** a user opens the original dialogue action from a saved dialogue summary but the referenced dialogue data is no longer available
- **THEN** the system keeps the saved summary readable and shows that the original dialogue is unavailable

### Requirement: Dialogue summary UI SHALL be usable on desktop and mobile
The system SHALL provide clear generation, editing, saving, cancellation, success, and failure states for dialogue summaries on desktop and mobile.

#### Scenario: Generate action shows progress
- **WHEN** a user activates "生成摘要"
- **THEN** the action indicates generation is in progress and prevents duplicate summary requests until the request finishes

#### Scenario: Save action shows progress
- **WHEN** a user confirms saving an edited summary
- **THEN** the action indicates saving is in progress and prevents duplicate submissions until the request finishes

#### Scenario: Generation or save fails
- **WHEN** summary generation or saving fails
- **THEN** the UI shows a clear failure message and does not claim that the summary was saved

#### Scenario: Desktop and mobile flows are reachable
- **WHEN** the summary flow appears on desktop or mobile reader surfaces
- **THEN** the generate, edit, cancel, and save actions remain readable and reachable without hiding the underlying reading context permanently
