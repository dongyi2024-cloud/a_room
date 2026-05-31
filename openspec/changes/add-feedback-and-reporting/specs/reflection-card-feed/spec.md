## ADDED Requirements

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
