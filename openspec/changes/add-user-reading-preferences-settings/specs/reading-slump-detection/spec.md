## ADDED Requirements

### Requirement: Reading-slump detection respects user preference
The system SHALL NOT record new reading-slump behavior events or update reading-slump detection state for a user while that user's reading-slump detection setting is disabled.

#### Scenario: Disabled setting blocks new event recording
- **WHEN** a logged-in user has reading-slump detection disabled
- **AND** the reader attempts to record a reading behavior event
- **THEN** the system does not insert a new `reading_behavior_events` row for that event
- **AND** the reader remains usable without surfacing a blocking error

#### Scenario: Disabled setting blocks state evaluation
- **WHEN** a logged-in user has reading-slump detection disabled
- **AND** reading-slump state would normally be evaluated for a book
- **THEN** the system does not update `reading_slump_states` for that user and book
- **AND** downstream consumers receive a non-eligible state or disabled response

#### Scenario: Re-enabled setting resumes detection
- **WHEN** a logged-in user turns reading-slump detection back on
- **AND** the reader records a supported reading behavior event
- **THEN** the system may insert the event and evaluate reading-slump state using the active rule configuration

### Requirement: Existing reading-slump data remains private when detection is disabled
The system SHALL keep previously stored reading-slump events and state owner-scoped and MUST NOT expose them to other users when detection is disabled.

#### Scenario: User disables detection with existing history
- **WHEN** a user with existing reading-slump history disables detection
- **THEN** the system does not delete the existing owner-scoped history in P1
- **AND** the system stops using it for new reminder eligibility while the setting remains disabled
