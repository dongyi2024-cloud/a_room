## ADDED Requirements

### Requirement: Detection state exposes rescue-pack reminder eligibility
The system SHALL expose reading-slump reminder eligibility in a form that rescue-pack reminder surfaces can consume without recalculating detection rules.

#### Scenario: Eligible state can be consumed by reminder layer
- **WHEN** a downstream rescue-pack reminder surface requests the latest reading-slump state for a user and book
- **THEN** the state includes status, triggered signals, evaluated time, suppression fields, and `isReminderEligible`

#### Scenario: Reminder layer does not change detection rules
- **WHEN** the rescue-pack reminder surface consumes reading-slump state
- **THEN** it does not alter rule thresholds, triggered signals, or stored detection status except through the existing dismissal/suppression flow

#### Scenario: Dismissal remains the suppression mechanism
- **WHEN** a rescue-pack reminder is dismissed
- **THEN** the system uses the existing reminder-dismissal behavior to update suppression state for the current user and book
