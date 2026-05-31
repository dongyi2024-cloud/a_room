## Purpose

Define how eligible reading-slump states trigger non-blocking rescue-pack reminders, browser notification authorization, in-app fallback behavior, dismissal, and rescue-pack click-through.

## Requirements

### Requirement: Slump state can trigger a rescue-pack reminder
The system SHALL show a rescue-pack reminder when the current user/book reading-slump state is eligible for reminders.

#### Scenario: Eligible slump state shows reminder
- **WHEN** a logged-in reader opens a book whose latest reading-slump state is `at_risk` or `slump`
- **AND** the state has `isReminderEligible` set to true
- **THEN** the reader shows a non-blocking rescue-pack reminder entry

#### Scenario: Steady state does not show reminder
- **WHEN** a logged-in reader opens a book whose latest reading-slump state is `steady`
- **THEN** the reader does not show a rescue-pack reminder

#### Scenario: Suppressed state does not show reminder
- **WHEN** a logged-in reader opens a book whose latest reading-slump state is within an active reminder suppression cooldown
- **THEN** the reader does not show another rescue-pack reminder for that book

### Requirement: Reminder falls back to in-app display when notification permission is unavailable
The system SHALL provide an in-app rescue-pack reminder whenever browser notification delivery is unavailable, unsupported, denied, or not yet authorized.

#### Scenario: Browser notification unsupported
- **WHEN** the browser does not support the Notification API or required PWA notification features
- **THEN** the system uses the in-app reminder and does not fail the reader

#### Scenario: Notification permission not granted
- **WHEN** notification permission is `default` or `denied`
- **THEN** the system uses the in-app reminder and does not send a browser notification

#### Scenario: PC without notification support
- **WHEN** the reader is used on PC in an environment without usable browser notifications
- **THEN** the system either shows the in-app reminder or hides notification controls without breaking reading

### Requirement: Browser notifications require explicit user authorization
The system MUST NOT send a browser notification unless the user has explicitly granted notification permission.

#### Scenario: User grants notification permission
- **WHEN** an eligible reminder is visible and the user activates an explicit notification opt-in control
- **AND** the browser grants permission
- **THEN** the system may send browser notifications for eligible rescue-pack reminders

#### Scenario: User denies notification permission
- **WHEN** the user declines notification permission
- **THEN** the system does not send browser notifications and keeps the in-app reminder path available

#### Scenario: No automatic permission prompt
- **WHEN** the reader evaluates a slump state
- **THEN** the system does not automatically open the browser permission prompt without a user action

### Requirement: Reminder frequency is limited
The system SHALL respect reading-slump reminder suppression and prevent repeated notifications for the same eligible state.

#### Scenario: User closes reminder
- **WHEN** the user closes a rescue-pack reminder
- **THEN** the system records reminder dismissal for the current user and book
- **AND** future reminders for that user/book are suppressed until the cooldown expires

#### Scenario: Same eligible state does not notify repeatedly
- **WHEN** the same eligible reading-slump state is rendered multiple times in one client session
- **THEN** the system does not repeatedly send browser notifications for that same state

#### Scenario: Cooldown expired
- **WHEN** the suppression cooldown has expired and the book is still eligible for reminders
- **THEN** the rescue-pack reminder may appear again

### Requirement: Reminder opens the rescue-pack entry
The system SHALL route users from a rescue-pack reminder to the rescue-pack entry for the current book/chapter.

#### Scenario: User clicks in-app reminder
- **WHEN** the user activates the in-app rescue-pack reminder
- **THEN** the reader opens the rescue-pack entry for the current book and chapter

#### Scenario: User clicks browser notification
- **WHEN** the user activates a browser notification for an eligible rescue-pack reminder
- **THEN** the app opens or focuses the reader at the rescue-pack entry for the current book and chapter

#### Scenario: Rescue-pack content unavailable
- **WHEN** the rescue-pack entry has no generated content yet
- **THEN** the system shows a friendly empty or placeholder state instead of failing

### Requirement: Users can turn off rescue-pack reminders
The system SHALL let users close or disable rescue-pack reminders without losing reading progress.

#### Scenario: User dismisses current reminder
- **WHEN** the user dismisses the current reminder
- **THEN** the reminder disappears and reading progress remains unchanged

#### Scenario: User disables reminder prompts
- **WHEN** the user chooses not to see rescue-pack reminders again in the current supported preference scope
- **THEN** the system stops showing the reminder surface according to that preference while leaving reading-slump detection intact

### Requirement: Reminder UI works on mobile and degrades safely on desktop
The system SHALL render the rescue-pack reminder in a mobile-friendly way and SHALL keep PC reading usable.

#### Scenario: Mobile reminder layout
- **WHEN** the eligible reminder appears on a mobile viewport
- **THEN** it remains readable, tappable, and does not cover the full reading text as a blocking modal

#### Scenario: Desktop reminder behavior
- **WHEN** the eligible reminder appears on a desktop viewport
- **THEN** it appears as an in-app prompt or is safely omitted if the desktop surface does not support it
