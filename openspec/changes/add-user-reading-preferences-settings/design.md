## Context

The app already has settings pages for long-term memory and personal notes, and the reader already records behavior events that feed reading-slump detection and rescue-pack reminders. Users do not yet have a general reading-preferences surface for comfort and privacy controls.

Theme mode is a reader-wide UI preference. Reading-slump detection is a behavior-analysis preference and must be enforced at the recording/evaluation layer, not only hidden in the UI.

## Goals / Non-Goals

**Goals:**
- Add a per-user reading preferences settings page.
- Persist day/night theme mode and reading-slump detection enablement for authenticated users.
- Apply the selected theme across settings, bookshelf, reader, notes, and community surfaces.
- Stop recording new reading-slump behavior events and stop evaluating/updating slump state when the user disables reading-slump detection.
- Prevent rescue-pack reminders and notification opt-in prompts from appearing when detection is disabled.

**Non-Goals:**
- No automatic OS theme syncing in P1 unless implemented as a local fallback detail.
- No theme editor, custom palettes, font controls, or per-book theme settings.
- No deletion or anonymization of historical reading behavior events in P1.
- No change to the rescue-pack content itself.
- No change to long-term memory settings semantics.

## Decisions

### Use a dedicated app settings model

Create a dedicated per-user settings model, tentatively `user_app_settings`, instead of expanding `user_memory_settings`.

Rationale:
- Theme mode and slump detection are app-level preferences, not memory preferences.
- This keeps future settings such as font size, notification preferences, or reader layout from polluting memory-specific tables.

Alternative considered: add fields to `profiles`. This would work technically, but profiles already carry identity/display data and would become a mixed preference container.

### Support explicit light and dark modes

P1 will support `light` and `dark` values. The default SHALL be `light`.

Rationale:
- The requested product language is day/night mode.
- This avoids ambiguity around `system` mode and first-paint behavior.

Alternative considered: include `system`. This can be added later, but it expands test cases and makes persistence/fallback behavior less clear.

### Store in database and mirror locally for fast paint

The authenticated server-rendered page should load persisted preferences from the database. The client may mirror `themeMode` to localStorage or a document attribute to reduce flash during navigation/refresh.

Rationale:
- Database persistence keeps settings stable across devices.
- A local mirror improves perceived UX without becoming the source of truth.

### Gate slump detection in the backend

When `reading_slump_detection_enabled` is false, `/api/reading-events` and the data layer should avoid inserting new detection events and avoid recalculating `reading_slump_states`.

Rationale:
- A frontend-only switch would still collect behavior data, which violates user expectation.
- The API is the central enforcement point for current reader instrumentation.

The API can return a successful response with a steady/disabled state shape, or a clear disabled response that the caller treats as non-error. It MUST NOT break normal reader usage.

### Keep historical data but stop using it while disabled

P1 will not delete historical `reading_behavior_events` or `reading_slump_states` when detection is disabled.

Rationale:
- Deleting historical data is a separate privacy/data-retention feature.
- The immediate requirement is control over ongoing detection and reminders.

### Rescue-pack reminders consume settings explicitly

The reader/reminder layer should know whether detection is enabled before rendering reminders or requesting notification permission.

Rationale:
- Reminder UI is downstream of detection. If detection is disabled, reminder surfaces should be silent even if old state remains in the database.

## Risks / Trade-offs

- Theme flash on first paint -> mitigate by applying a persisted or locally mirrored theme attribute as early as practical.
- Existing reader event calls may assume a normal slump state response -> mitigate by keeping disabled responses non-fatal and updating response typing/tests.
- Multiple settings pages could fragment navigation -> mitigate with a clear bookshelf entry and consistent settings-page links.
- Remote Supabase schemas may not include the new table immediately -> provide SQL migration guidance and friendly API errors.
