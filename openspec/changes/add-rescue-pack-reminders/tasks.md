## 1. Existing Flow Inspection

- [x] 1.1 Inspect reader state, reading-slump API usage, and dismiss endpoint to identify the least invasive reminder insertion point.
- [x] 1.2 Inspect whether a rescue-pack entry/anchor already exists; if absent, define the minimal placeholder target for this change.

## 2. Reminder Eligibility And State

- [x] 2.1 Add a client-side reminder eligibility helper that uses `status !== "steady"` and `isReminderEligible === true`.
- [x] 2.2 Track per-book/per-evaluation client notification send state to avoid duplicate notifications in one session.
- [x] 2.3 Add local preference handling for closing/disabling rescue-pack reminder prompts if no existing server setting is available.

## 3. Reader Reminder UI

- [x] 3.1 Add a non-blocking in-app rescue-pack reminder surface to the reader for eligible slump states.
- [x] 3.2 Include reminder copy, rescue-pack entry action, close/dismiss action, and optional notification opt-in action.
- [x] 3.3 Ensure the reminder layout is mobile-friendly and does not block the reading text.
- [x] 3.4 Ensure desktop behavior is safe: show an in-app prompt or omit unsupported notification controls without breaking the reader.

## 4. Notification Permission And Dispatch

- [x] 4.1 Add browser Notification API feature detection.
- [x] 4.2 Request notification permission only after an explicit user action.
- [x] 4.3 Send browser notifications only when permission is granted.
- [x] 4.4 Fall back to in-app reminder when notification permission is default, denied, or unsupported.

## 5. Click-through And Dismissal

- [x] 5.1 Route in-app reminder clicks to the current book/chapter rescue-pack entry.
- [x] 5.2 Route browser notification clicks to the reader rescue-pack entry where browser support allows.
- [x] 5.3 Add a friendly empty/placeholder state if rescue-pack content is unavailable.
- [x] 5.4 Wire close/dismiss to `POST /api/reading-events/dismiss` so cooldown suppression remains server-backed.

## 6. Tests And Validation

- [x] 6.1 Add tests or source checks for reminder eligibility, suppression, and no duplicate browser notifications for the same state.
- [x] 6.2 Add tests or source checks for notification permission gating and in-app fallback.
- [x] 6.3 Add tests or source checks for rescue-pack click-through and dismiss API usage.
- [x] 6.4 Run `npm run test:reading-slump` and any new rescue-reminder test script.
- [x] 6.5 Run `npx tsc --noEmit`.
- [x] 6.6 Run `npm run build`.
- [x] 6.7 Run `openspec validate add-rescue-pack-reminders --strict`.
- [x] 6.8 Manually verify mobile and PC behavior: eligible reminder appears, unauthorized notifications fall back in-app, permission opt-in is explicit, dismiss suppresses reminders, and click-through opens the rescue-pack entry.
