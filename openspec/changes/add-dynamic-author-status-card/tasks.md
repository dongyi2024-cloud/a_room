## 1. Data Model

- [x] 1.1 Add `author_status_cards` table, unique constraint, indexes, and owner-scoped RLS policies to `supabase/schema.sql`
- [x] 1.2 Update Supabase TypeScript types for `author_status_cards`
- [x] 1.3 Add schema-missing error handling for local environments where the migration has not been applied

## 2. TimeMood and Fallbacks

- [x] 2.1 Implement server-side `getTimeMood(hour)` with the six required periods and fixed `period`, `mood`, `scene`, and `cta` values
- [x] 2.2 Implement deterministic fallback card copy for 清晨、上午、中午、下午、夜晚、深夜
- [x] 2.3 Add unit coverage for boundary hours, including 04:59, 05:00, 08:59, 09:00, 21:59, and 22:00

## 3. Reading Context and Cache

- [x] 3.1 Implement authenticated latest-reading-context loading from ready books, chapters, and `reading_behavior_events`
- [x] 3.2 Compute safe `book_title`, `chapter_title`, `progress`, and `last_read_at` fields when data is available
- [x] 3.3 Implement cache read/write helpers keyed by `user_id`, `card_date`, and `time_period`
- [x] 3.4 Ensure no-record users return period fallback content without throwing

## 4. AI Generation

- [x] 4.1 Add the author status card JSON-only system prompt with fixed timeMood and reading-context rules
- [x] 4.2 Reuse the server-side DeepSeek completion helper for one bounded generation call
- [x] 4.3 Validate JSON output fields, voice separation, CTA handling, and no-context fabrication rules
- [x] 4.4 Return fallback content when AI is unavailable, JSON parsing fails, or validation rejects the output

## 5. API

- [x] 5.1 Add `GET /api/author-status` with authenticated user handling
- [x] 5.2 Return `period`, `woolf_status`, `thought_title`, `thought_body`, `cta_hint`, and `from_cache`
- [x] 5.3 Confirm cache hits do not call AI and new time periods can generate separate rows
- [x] 5.4 Keep homepage-safe responses for AI failure and cache-table failure paths

## 6. Homepage Integration

- [x] 6.1 Update the homepage author status card to load `/api/author-status`
- [x] 6.2 Replace only Woolf status, thought title, thought body, and primary CTA label from API data
- [x] 6.3 Preserve current homepage layout, card visual style, button styling, and existing reader / Ask Woolf routes
- [x] 6.4 Keep loading and error states usable with default fallback copy

## 7. Verification

- [x] 7.1 Test all six time periods return distinct period-aware content
- [x] 7.2 Test users with reading records receive book/chapter/progress-aware AI input without invented optional context
- [x] 7.3 Test users without reading records receive default copy
- [x] 7.4 Test same-user same-day same-period cache hit returns `from_cache: true`
- [x] 7.5 Test AI failure does not crash `/api/author-status` or the homepage
- [x] 7.6 Test PC and mobile homepage rendering does not break current layout, buttons, or routes
- [x] 7.7 Run `npx tsc --noEmit` and `npm run build`
