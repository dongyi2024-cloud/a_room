## Why

F35 already detects reading slump state but deliberately stays non-intrusive. F36 turns that detection state into a controlled rescue-pack reminder entry so users can get help when they stall, without forcing interruptions or depending on native mobile push infrastructure.

## What Changes

- Add a rescue-pack reminder capability that reads per-user/book slump state and decides whether a reminder is eligible.
- Provide an in-app reminder surface for eligible `at_risk` or `slump` states.
- Allow users to close reminders and reuse the existing cooldown/suppression behavior.
- Add an optional browser notification permission flow for environments that support Web Notifications/PWA-style notification APIs.
- Require user authorization before sending browser notifications.
- Route reminder clicks to the rescue-pack entry for the current book/chapter.
- Keep PC support minimal: station-in-app reminder is sufficient, and unsupported browser notification features must degrade safely.

## Capabilities

### New Capabilities
- `rescue-pack-reminders`: Defines slump-triggered rescue-pack reminders, notification authorization, in-app fallback, dismissal/cooldown, and click-through behavior.

### Modified Capabilities
- `reading-slump-detection`: Clarifies that downstream rescue-pack reminder logic may consume `isReminderEligible` and suppression state without changing the detection rules.

## Impact

- Reader UI: add a non-blocking reminder entry when slump state is eligible.
- Reading slump APIs/data: reuse existing `GET /api/reading-events` state and `POST /api/reading-events/dismiss` cooldown behavior.
- Client notification layer: add permission detection and authorized browser notification dispatch where supported.
- Rescue-pack routing: add or standardize a reader-side rescue-pack target/anchor for reminder clicks.
- Tests: cover eligibility, unauthorized fallback, authorized notification path, dismissal, cooldown, click-through, and PC/mobile rendering.
