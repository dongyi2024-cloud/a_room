## ADDED Requirements

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
