## ADDED Requirements

### Requirement: Users can start a community share from eligible personal notes
The system SHALL let a logged-in user start a share-to-community flow from an owned personal note that has book, chapter, and paragraph context.

#### Scenario: Share entry appears on eligible note
- **WHEN** a logged-in user views an owned personal note with valid book, chapter, and paragraph bindings
- **THEN** the note shows a restrained “分享到社区” action

#### Scenario: Dialogue summary note is eligible
- **WHEN** a logged-in user views an owned note whose source type is `dialogue_summary` and the note has valid reading context
- **THEN** the note can enter the share-to-community flow

#### Scenario: Ineligible note cannot be shared
- **WHEN** a note is missing book, chapter, paragraph, or source content required for a community card
- **THEN** the system does not expose a working publish action for that note

### Requirement: Share flow requires user review before publishing
The system SHALL generate an editable share draft and SHALL NOT publish the community card until the user explicitly confirms.

#### Scenario: Generated draft opens for review
- **WHEN** the user activates “分享到社区” on an eligible note
- **THEN** the system shows a share draft editor with the draft content and the related book, chapter, and paragraph context

#### Scenario: User edits draft before publishing
- **WHEN** the user changes the generated share draft and confirms publishing
- **THEN** the published community card uses the edited content

#### Scenario: User cancels share
- **WHEN** the user cancels the share confirmation flow
- **THEN** no community card is created and the private note remains unchanged

### Requirement: Share draft protects private dialogue by default
The system MUST NOT include full original AI dialogue turns or hidden private note metadata in the generated public draft by default.

#### Scenario: Dialogue summary draft excludes raw dialogue history
- **WHEN** the system generates a share draft from a `dialogue_summary` note that stores original dialogue turns in metadata
- **THEN** the draft uses the saved summary content and does not copy the full original dialogue turns into the public draft

#### Scenario: User can publish only reviewed public text
- **WHEN** the user confirms publishing a dialogue-summary share
- **THEN** only the edited public share content is saved to the community card

### Requirement: Share publishing validates authentication and ownership
The system MUST reject share publishing unless the current user is authenticated, owns the source note, and owns the note's reading context.

#### Scenario: Unauthenticated share is rejected
- **WHEN** an unauthenticated client attempts to publish a note share
- **THEN** the system rejects the request and creates no community card

#### Scenario: Cross-user note share is rejected
- **WHEN** a logged-in user attempts to publish from another user's personal note
- **THEN** the system rejects the request and does not reveal that note's content

#### Scenario: Invalid context share is rejected
- **WHEN** the source note references a book, chapter, or paragraph that is unavailable or no longer belongs together
- **THEN** the system rejects publishing and returns a bounded failure state

### Requirement: Published note shares appear in the community feed
The system SHALL publish a confirmed note share as a paragraph-bound community reflection card.

#### Scenario: Confirmed share creates community card
- **WHEN** the user confirms a valid note share
- **THEN** the system creates a community card bound to the source note's book, chapter, and paragraph

#### Scenario: Published share appears in aggregate community
- **WHEN** the user opens the community card feed after publishing a note share
- **THEN** the new card appears in the aggregate feed with its book, chapter, paragraph excerpt, content, author display name, and creation time

#### Scenario: Published share appears in paragraph feed
- **WHEN** the user opens the source paragraph's reflection feed after publishing a note share
- **THEN** the new card appears alongside other cards for that paragraph

### Requirement: Share flow provides safe desktop and mobile states
The system SHALL provide usable loading, success, cancel, and failure states for note sharing on desktop and mobile.

#### Scenario: Publish shows progress
- **WHEN** the user confirms publishing a share
- **THEN** the action indicates progress and prevents duplicate submissions until the request finishes

#### Scenario: Publish succeeds
- **WHEN** the community card is created successfully
- **THEN** the UI confirms the share and provides a path to view the community card or community feed

#### Scenario: Publish fails
- **WHEN** the share cannot be published due to validation, network, or server failure
- **THEN** the UI shows a clear failure message and does not remove or alter the private note

#### Scenario: Desktop and mobile share flows are usable
- **WHEN** the note share flow is opened on desktop or mobile
- **THEN** the editor, cancel action, and publish action remain readable and reachable without breaking the notes page layout
