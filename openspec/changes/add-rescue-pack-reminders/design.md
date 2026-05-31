## Context

F35 has already created the reading-slump foundation: behavior events, configurable rules, persisted per-user/book detection state, `isReminderEligible`, dismissal suppression, and cooldown. F36 should not reimplement detection. It should consume the detection result and provide a controlled reminder entry to a future or current rescue-pack surface.

The product is currently a Next.js web app, not a native mobile app. Therefore P1 should prioritize in-app reminders and optionally use the browser Notification API only after explicit user permission. Unsupported notification environments must degrade to in-app reminders.

## Goals / Non-Goals

**Goals:**
- Show a non-blocking rescue-pack reminder when the current book's slump state is `at_risk` or `slump` and `isReminderEligible` is true.
- Provide an in-app reminder fallback for all supported browsers, including when notification permission is denied or unavailable.
- Ask for browser notification permission only through a user action, and send browser notifications only after permission is granted.
- Let the user dismiss/close the reminder and reuse the existing suppression cooldown.
- Route clicks to the rescue-pack entry for the current book/chapter.
- Keep PC behavior safe: in-app reminder is sufficient, and browser notifications can remain unavailable.

**Non-Goals:**
- Do not implement full native mobile push, service-worker push subscriptions, server push queues, APNs, FCM, or background delivery.
- Do not generate rescue-pack content in this change; F37 owns rescue-pack content.
- Do not change reading-slump detection thresholds or detection algorithms.
- Do not make slump reminders blocking modals.
- Do not send notifications without explicit browser permission.

## Decisions

### Use existing slump eligibility as the trigger

The reminder layer should rely on `ReadingSlumpEvaluationResult.isReminderEligible` plus `status !== "steady"`. This preserves F35's cooldown and rule configuration contract and avoids duplicating suppression logic.

Alternative considered: maintain a separate reminder eligibility table. That adds persistence and sync complexity without a P1 need because `reading_slump_states` already stores `reminder_suppressed_until` and `last_dismissed_at`.

### Prefer in-app reminder, optionally browser notification

The reader should always be able to render an in-app reminder when eligible. Browser Notification API support should be optional and guarded by feature detection:

- unsupported API -> in-app reminder only;
- permission `default` -> show an opt-in action, do not request permission automatically;
- permission `granted` -> browser notification may be sent once per eligible state/window;
- permission `denied` -> in-app reminder only.

This meets the P1 requirement without pretending to provide true native push.

### Keep notification authorization local first

P1 can store notification preference and “do not show again” state locally if no server-side preference table exists. Dismissal/cooldown remains server-side through the existing reading-events dismiss API so reminders are still rate-limited per user/book.

If implementation discovers an existing user-settings table suitable for preferences, it may use it, but this change should not require a new global notification subscription backend.

### Route to a rescue-pack target without requiring F37 content

Reminder click-through should navigate to a stable rescue-pack entry for the reader, for example a query parameter or anchor such as `?rescue=1` / `#rescue-pack`. If F37 content is not implemented, the target can show a friendly placeholder or existing rescue-pack entry point. The reminder feature should not fail because rescue content is empty.

### Reuse existing dismiss endpoint

Closing the reminder should call `POST /api/reading-events/dismiss` with the current `bookId`. This records `reminder_dismissed`, updates `reminder_suppressed_until`, and prevents frequent retriggering.

## Risks / Trade-offs

- Browser notifications are not real push -> Make the spec explicit: P1 supports browser notifications only while the app can execute client code; in-app reminder remains the reliable path.
- Reminder fatigue -> Use `isReminderEligible` and existing cooldown suppression; do not show reminders when suppressed.
- Permission prompt annoyance -> Request notification permission only after user clicks an explicit opt-in control.
- Rescue-pack target may not have content yet -> Link to a stable entry and show a friendly empty state until F37 fills content.
- Duplicate browser notifications during rerenders -> Track client-side sent state per `bookId + evaluatedAt` so the same eligible state does not notify repeatedly.
