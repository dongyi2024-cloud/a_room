## Why

Users currently have separate settings for long-term memory and notes, but no central place to control reading experience preferences. Theme choice and reading-slump detection both affect comfort and privacy, so users need explicit controls instead of implicit defaults.

## What Changes

- Add a user reading preferences settings surface where users can choose day or night mode.
- Add a user-controlled switch for reading-slump detection.
- Persist preferences per authenticated user.
- Ensure the reader applies the selected theme consistently after navigation and refresh.
- Ensure reading behavior recording, slump state evaluation, and rescue-pack reminders respect the reading-slump detection setting.
- Add entry points from the bookshelf/settings navigation to the new settings surface.

## Capabilities

### New Capabilities

- `user-reading-preferences`: User-facing reading preference controls, including theme mode and reading-slump detection enablement.

### Modified Capabilities

- `reading-slump-detection`: Reading behavior recording and slump evaluation must be disabled when the user turns off reading-slump detection.
- `rescue-pack-reminders`: Rescue-pack reminders must not display or request notifications when reading-slump detection is disabled.
- `bookshelf`: The bookshelf/settings navigation must expose the reading preferences settings entry.

## Impact

- Supabase schema and generated types for a new per-user settings table or equivalent persisted settings model.
- New or extended settings API for reading preferences.
- New settings page and reusable preference controls.
- Reader shell, reading-events API, slump detection data layer, and rescue-pack reminder behavior.
- Global styles/theme application and local fallback to reduce theme flash.
- Tests/source checks for schema, API, UI controls, reader behavior, and OpenSpec validation.
