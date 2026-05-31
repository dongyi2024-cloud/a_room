## Purpose

Define how paragraph-bound reflection cards are published, rendered, aggregated into the community feed, and protected from context-free posting or private source leakage.
## Requirements
### Requirement: Users can view paragraph-bound reflection cards in both local and aggregated feeds
The system SHALL keep every reflection card bound to a specific book, chapter, and paragraph, while allowing the community page to aggregate cards across all paragraphs.

#### Scenario: Reader opens reflection feed for a paragraph
- **WHEN** the user activates the reflection entry for a paragraph inside the reader
- **THEN** the system displays reflection cards associated with that exact book, chapter, and paragraph

#### Scenario: Community page opens the aggregated reflection feed
- **WHEN** the user opens the community view
- **THEN** the system displays reflection cards from all available paragraph contexts in a single time-ordered feed

### Requirement: Reflection cards remain bound to paragraph context
The system MUST bind every reflection card to a concrete book, chapter, and paragraph, and it MUST NOT allow publishing a context-free reflection post.

#### Scenario: Reader publish flow binds to current paragraph
- **WHEN** the user publishes a reflection from a paragraph-level reader entry
- **THEN** the new reflection is stored with the current book, chapter, and paragraph binding

#### Scenario: Community view does not expose a context-free publish flow
- **WHEN** the user opens the aggregated community view
- **THEN** the system does not offer a working publish flow for a generic reflection post

### Requirement: Logged-in users can publish paragraph-bound reflections from the reader
The system SHALL allow logged-in users to publish a paragraph-bound reflection from the reader, while the community page remains a browse-only aggregation surface in P0.

#### Scenario: Publish reflection beside a reader paragraph
- **WHEN** a logged-in user submits a valid reflection from the paragraph-level reader entry
- **THEN** the system creates the reflection card and shows it in that paragraph's reflection feed

#### Scenario: Community page does not create context-free reflections
- **WHEN** the user opens the aggregated community view
- **THEN** the system does not offer a generic publish box that can create a context-free reflection post

#### Scenario: Unauthenticated user cannot publish
- **WHEN** a user is not logged in and attempts to publish a reflection
- **THEN** the system rejects the write and keeps the reflection feed read path safe

### Requirement: Reflection cards show paragraph-aware metadata
The system SHALL render each reflection card with enough context to reconnect the reflection to the paragraph it came from, and it SHALL also show the card's like control, like count, and current-user like state, while rendering an owner-only delete affordance for cards owned by the current user.

#### Scenario: Render reflection card fields
- **WHEN** a reflection card is displayed in the reader or community feed
- **THEN** the card shows the publisher display name, related book, related chapter, paragraph excerpt, reflection content, creation time, like control, like count, whether the current user has liked it, and a delete entry only when the current user owns that card

#### Scenario: Like interaction updates the visible card
- **WHEN** the user likes or unlikes a reflection card
- **THEN** the rendered card updates to reflect the latest count and current-user like state without disconnecting from the surrounding feed

#### Scenario: Deleted card is removed from the visible feed
- **WHEN** the current user confirms deletion of their own reflection card
- **THEN** that card is removed from the current visible reflection list

### Requirement: Reflection feeds provide empty state and safe degradation
The system SHALL provide a friendly empty state when a paragraph has no reflections, and reflection features MUST NOT break the reader when data loading, publishing, or deleting fails.

#### Scenario: Empty reflection feed
- **WHEN** the current paragraph feed or aggregated community feed has no reflection cards yet
- **THEN** the system shows a friendly empty-state message instead of a blank area

#### Scenario: Reflection feature fails in reader
- **WHEN** the paragraph reflection feed cannot be loaded, published, or deleted due to an application or network error
- **THEN** the system keeps the reader usable and limits the failure to the reflection surface

#### Scenario: Reflection feed works on desktop and mobile
- **WHEN** the user opens a paragraph reflection feed on desktop or mobile
- **THEN** the feed remains readable and usable on that device class

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

### Requirement: Reflection cards can be reported
The system SHALL provide a report action for community reflection cards.

#### Scenario: Report action appears on community card
- **WHEN** a logged-in user views a community reflection card
- **THEN** the card offers a restrained report action

#### Scenario: User reports a card
- **WHEN** the user submits a report for a community reflection card with a supported feedback type
- **THEN** the system creates a feedback report targeting that card

#### Scenario: Report action fails safely
- **WHEN** reporting a reflection card fails
- **THEN** the card remains visible and the UI shows a bounded failure message

### Requirement: Repeated reports can put reflection cards into review state
The system SHALL support a pending-review state for repeatedly reported reflection cards.

#### Scenario: Repeated reports reach threshold
- **WHEN** a reflection card receives enough accepted reports to reach the configured threshold
- **THEN** the card is marked as pending review

#### Scenario: Pending review does not break feeds
- **WHEN** a reflection card is pending review
- **THEN** reflection feeds remain usable and render according to the current moderation display policy

