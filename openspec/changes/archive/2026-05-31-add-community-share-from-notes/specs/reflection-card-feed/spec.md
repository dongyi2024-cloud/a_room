## ADDED Requirements

### Requirement: Reflection feed accepts cards published from personal notes
The system SHALL allow confirmed personal-note shares to create normal paragraph-bound reflection cards that appear in existing reflection feeds.

#### Scenario: Note share creates a standard reflection card
- **WHEN** a logged-in user confirms publishing an owned note share with valid paragraph context
- **THEN** the resulting card is stored and rendered through the same reflection card feed behavior as cards written directly from the reader

#### Scenario: Note share does not create a context-free post
- **WHEN** a note share request does not resolve to a valid book, chapter, and paragraph
- **THEN** the system rejects the request and does not create a reflection card

#### Scenario: Note share card supports existing card interactions
- **WHEN** a published note-share card appears in a reflection feed
- **THEN** users can view, like, unlike, and owner-delete it according to the existing reflection card rules

### Requirement: Reflection feed preserves source privacy for note-share cards
The system MUST render note-share reflection cards using only public card fields and MUST NOT expose private note metadata or full dialogue history in the community feed.

#### Scenario: Community feed hides private source note metadata
- **WHEN** a reflection card was created from a personal note
- **THEN** the community feed shows the card content and reading context but does not expose the source note id, private note fields, or hidden metadata to other users

#### Scenario: Dialogue history is not rendered from a note-share card
- **WHEN** a reflection card was created from a dialogue summary note
- **THEN** the community feed does not render the original AI dialogue turns unless the user explicitly included that text in the public card content
