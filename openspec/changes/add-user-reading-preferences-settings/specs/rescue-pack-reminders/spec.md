## ADDED Requirements

### Requirement: Rescue-pack reminders respect reading-slump detection preference
The system SHALL NOT show rescue-pack reminders or request browser notification permission for rescue-pack reminders when reading-slump detection is disabled for the current user.

#### Scenario: Detection disabled hides reminder
- **WHEN** a logged-in reader opens a book while reading-slump detection is disabled
- **THEN** the reader does not show a rescue-pack reminder even if an older stored slump state is eligible

#### Scenario: Detection disabled blocks notification prompt
- **WHEN** reading-slump detection is disabled
- **AND** the browser notification permission has not been granted
- **THEN** the system does not show or trigger a rescue-pack notification opt-in prompt

#### Scenario: Detection re-enabled allows future reminders
- **WHEN** a user turns reading-slump detection back on
- **AND** future detection state becomes eligible for reminders
- **THEN** rescue-pack reminders may appear according to the existing reminder eligibility and suppression rules
