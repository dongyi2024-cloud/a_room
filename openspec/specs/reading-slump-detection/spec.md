## Purpose

Define how the system records reading behavior, evaluates configurable reading-slump signals, and exposes non-intrusive per-user/book detection state for future rescue-pack and reminder features.

## Requirements

### Requirement: System records basic reading behavior events
The system SHALL record authenticated reader behavior events needed for slump detection and MUST bind each recorded event to `user_id` and `book_id`.

#### Scenario: Reader opens a book
- **WHEN** a logged-in user opens a readable book on PC or mobile
- **THEN** the system records a reader-open event for that `user_id` and `book_id`

#### Scenario: Reader makes progress
- **WHEN** a logged-in user reaches a new chapter or paragraph position in a book
- **THEN** the system records a progress event with the current book, chapter, and paragraph position

#### Scenario: Selected-text question is asked
- **WHEN** a logged-in user asks AI about selected text in the reader
- **THEN** the system records a question event for the current `user_id`, `book_id`, chapter, and paragraph without storing the full selected text or AI answer

### Requirement: System detects reading slump from configurable rules
The system SHALL evaluate reading slump by applying configurable rules to recent reading behavior and progress data.

#### Scenario: Inactivity rule is triggered
- **WHEN** a user's last progress event for a book is older than the configured inactivity threshold
- **THEN** the system marks inactivity as a triggered slump signal for that user and book

#### Scenario: Chapter stagnation rule is triggered
- **WHEN** a user remains in the same chapter longer than the configured chapter-stagnation threshold without meaningful paragraph progress
- **THEN** the system marks chapter stagnation as a triggered slump signal for that user and book

#### Scenario: Repeated-open rule is triggered
- **WHEN** a user opens the same book or page at least the configured number of times without meaningful progress
- **THEN** the system marks repeated opens without progress as a triggered slump signal for that user and book

#### Scenario: Frequent comprehension-question rule is triggered
- **WHEN** a user asks comprehension-oriented selected-text questions at least the configured number of times within the configured window
- **THEN** the system marks frequent comprehension questions as a triggered slump signal for that user and book

#### Scenario: Low chapter-completion rule is triggered
- **WHEN** a user's completed portion of the current chapter is below the configured completion threshold after the configured reading window
- **THEN** the system marks low chapter completion as a triggered slump signal for that user and book

### Requirement: Detection result is stored per user and book
The system SHALL persist the latest reading-slump detection result separately for each `user_id` and `book_id`.

#### Scenario: Detection result is saved
- **WHEN** slump rules are evaluated for a user and book
- **THEN** the system stores the detection status, triggered signals, rule version, evaluated time, and associated `user_id` and `book_id`

#### Scenario: Different books keep separate results
- **WHEN** the same user reads two different books
- **THEN** the system stores independent slump detection results for each book

#### Scenario: Different users keep separate results
- **WHEN** two users read the same book
- **THEN** the system stores independent slump detection results for each user

### Requirement: Detection remains non-intrusive
The system SHALL NOT directly force an interruption, modal, push notification, or reading block when a slump state is detected.

#### Scenario: Slump state is detected
- **WHEN** the system marks a user and book as being in reading slump
- **THEN** the reader remains usable without a forced blocking prompt
- **AND** downstream reminder or rescue-pack features may read the detection state as a trigger condition

### Requirement: Slump rules are configurable
The system SHALL keep slump detection thresholds and rule enablement configurable through versioned configuration.

#### Scenario: Rule threshold changes
- **WHEN** an operator changes the inactivity, stagnation, repeated-open, comprehension-question, completion, or cooldown threshold
- **THEN** future evaluations use the updated configuration
- **AND** stored detection results record the rule version used for evaluation

#### Scenario: Rule is disabled
- **WHEN** a configured rule is disabled
- **THEN** future evaluations do not trigger slump state from that disabled rule

### Requirement: PC and mobile behavior records use the same contract
The system SHALL use the same reading behavior event contract for PC and mobile reader interactions.

#### Scenario: Same action on different devices
- **WHEN** a user opens a book or makes progress from PC and later performs the same action from mobile
- **THEN** both actions are recorded with the same event type structure and user/book binding

### Requirement: Dismissed reminders are suppressed by cooldown
The system SHALL support suppression of repeated slump-triggered reminders after the user dismisses or closes a reminder for a user and book.

#### Scenario: User dismisses a reminder
- **WHEN** a user closes a reminder associated with a detected slump state
- **THEN** the system records reminder suppression for that `user_id` and `book_id` until the configured cooldown expires

#### Scenario: Cooldown prevents frequent retriggering
- **WHEN** downstream reminder logic checks slump eligibility during an active suppression cooldown
- **THEN** the detection state is not eligible for another frequent reminder trigger

#### Scenario: Cooldown expires
- **WHEN** the configured suppression cooldown has expired and slump rules are still triggered
- **THEN** the detection state may become eligible for downstream reminder or rescue-pack trigger checks again

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
