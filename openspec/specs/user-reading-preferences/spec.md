# user-reading-preferences Specification

## Purpose
TBD - created by archiving change add-user-reading-preferences-settings. Update Purpose after archive.
## Requirements
### Requirement: User can manage reading preferences
The system SHALL provide an authenticated reading preferences settings page where users can view and update reading experience preferences.

#### Scenario: Logged-in user opens reading preferences
- **WHEN** a logged-in user opens the reading preferences settings page
- **THEN** the system shows the user's current theme mode and reading-slump detection setting

#### Scenario: Unauthenticated user opens reading preferences
- **WHEN** a user without a valid login session opens the reading preferences settings page
- **THEN** the system redirects the user through the login-required flow

### Requirement: User can switch between day and night mode
The system SHALL let users choose between day mode and night mode and SHALL persist the selected mode for the authenticated user.

#### Scenario: User selects night mode
- **WHEN** a logged-in user changes theme mode to night mode
- **THEN** the system persists `theme_mode = dark`
- **AND** the visible app UI changes to the night theme without requiring a page reload

#### Scenario: User selects day mode
- **WHEN** a logged-in user changes theme mode to day mode
- **THEN** the system persists `theme_mode = light`
- **AND** the visible app UI changes to the day theme without requiring a page reload

#### Scenario: User refreshes after changing theme
- **WHEN** a user refreshes or reopens the app after saving a theme mode
- **THEN** the app applies the saved theme mode consistently

### Requirement: User can turn reading-slump detection on or off
The system SHALL let users enable or disable reading-slump detection from reading preferences.

#### Scenario: User disables reading-slump detection
- **WHEN** a logged-in user turns reading-slump detection off
- **THEN** the system persists `reading_slump_detection_enabled = false`
- **AND** the settings page shows the disabled state

#### Scenario: User enables reading-slump detection
- **WHEN** a logged-in user turns reading-slump detection on
- **THEN** the system persists `reading_slump_detection_enabled = true`
- **AND** future reader behavior may be evaluated by the reading-slump detection workflow

### Requirement: Reading preferences are isolated by user
The system SHALL bind reading preferences to `user_id` and MUST NOT expose one user's preferences to another user.

#### Scenario: Different users choose different preferences
- **WHEN** two users save different theme modes or reading-slump detection settings
- **THEN** each user sees only their own saved preferences after login

### Requirement: Reading preferences failures are recoverable
The system SHALL show recoverable feedback if reading preferences cannot be loaded or saved.

#### Scenario: Preferences fail to load
- **WHEN** the settings page cannot load the user's reading preferences
- **THEN** the system shows a clear fallback error without breaking navigation to the bookshelf

#### Scenario: Preferences fail to save
- **WHEN** a preference update request fails
- **THEN** the system keeps the previous visible state or restores it
- **AND** the user sees a clear failure message

