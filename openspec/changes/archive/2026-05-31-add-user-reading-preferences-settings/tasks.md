## 1. Data Model And Types

- [x] 1.1 Add persisted per-user app settings schema for `theme_mode` and `reading_slump_detection_enabled`.
- [x] 1.2 Add indexes and RLS policies so users can read/write only their own reading preferences.
- [x] 1.3 Update Supabase TypeScript table types and app-level reading preferences API types.
- [x] 1.4 Add a default-settings helper that creates or returns settings for existing users.

## 2. Settings API

- [x] 2.1 Add server data-layer functions to load and update reading preferences.
- [x] 2.2 Add an authenticated API route for reading preference GET/POST updates.
- [x] 2.3 Validate theme mode and reading-slump detection input with friendly errors.
- [x] 2.4 Ensure settings update failures do not corrupt existing preference state.

## 3. Settings UI And Navigation

- [x] 3.1 Add a reading preferences settings page.
- [x] 3.2 Add day/night segmented controls that update the page theme immediately after save.
- [x] 3.3 Add a reading-slump detection toggle with clear enabled/disabled state.
- [x] 3.4 Add recoverable loading and save error states.
- [x] 3.5 Add a bookshelf/settings navigation entry to the reading preferences page.
- [x] 3.6 Verify the settings UI is usable on PC and mobile.

## 4. Theme Application

- [x] 4.1 Apply persisted theme mode to the app shell or document root.
- [x] 4.2 Add night theme CSS variables/classes while preserving existing day theme styling.
- [x] 4.3 Mirror theme mode locally where needed to reduce refresh/navigation flash.
- [x] 4.4 Ensure reader, bookshelf, settings, notes, and community surfaces remain readable in both modes.

## 5. Reading-Slump Detection Integration

- [x] 5.1 Make reading-events API and data layer check the user's detection preference before recording events.
- [x] 5.2 When detection is disabled, avoid inserting `reading_behavior_events` and avoid updating `reading_slump_states`.
- [x] 5.3 Return a non-fatal disabled or non-eligible response so reader interactions continue normally.
- [x] 5.4 Resume normal event recording and evaluation after the setting is re-enabled.

## 6. Rescue-Pack Reminder Integration

- [x] 6.1 Prevent rescue-pack reminder rendering when reading-slump detection is disabled.
- [x] 6.2 Prevent browser notification opt-in prompts for rescue-pack reminders while detection is disabled.
- [x] 6.3 Ensure old eligible slump state does not show reminders while detection remains disabled.
- [x] 6.4 Ensure reminders can reappear under existing eligibility rules after detection is re-enabled.

## 7. Tests And Validation

- [x] 7.1 Add source checks or tests for schema, RLS, settings types, and settings API route.
- [x] 7.2 Add source checks or tests for theme mode persistence and UI controls.
- [x] 7.3 Add source checks or tests proving reading-events does not record/evaluate while detection is disabled.
- [x] 7.4 Add source checks or tests proving rescue-pack reminders respect the detection setting.
- [x] 7.5 Run the new reading preferences test script.
- [x] 7.6 Run existing reading-slump and rescue-pack reminder tests.
- [x] 7.7 Run `npx tsc --noEmit`.
- [x] 7.8 Run `npm run build`.
- [x] 7.9 Run `openspec validate add-user-reading-preferences-settings --strict`.
- [x] 7.10 Manually verify PC and mobile: theme switching, persisted refresh behavior, disabled detection stops reminders, re-enabled detection resumes normal behavior, and failure states are recoverable.
