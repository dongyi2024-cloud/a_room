## Context

The homepage currently renders `AuthorStatusCard` from static/book-derived content while preserving a recently tuned homepage visual system. Reading activity is already persisted in `reading_behavior_events`, and books/chapters/paragraphs live in Supabase tables behind authenticated server access. The new behavior needs a backend-owned time-period decision, a cached AI rewrite, and a resilient homepage API so card rendering never blocks the user from entering reading or Ask Woolf.

## Goals / Non-Goals

**Goals:**

- Determine the current time period in application code before any AI call.
- Generate a stable `timeMood` payload containing `period`, `mood`, `scene`, and `cta`.
- Read the user's latest ready-book reading context from server-side data, including book title, chapter title, progress, and last reading time when available.
- Cache one generated card per `user_id + card_date + time_period`.
- Preserve the existing homepage card structure and visual treatment while replacing dynamic text fields.
- Enforce separate voice rules: objective third-person `woolf_status` and first-person `thought_body`.
- Return safe fallback copy when reading context is missing, schema is not yet migrated, AI is unavailable, or generation validation fails.

**Non-Goals:**

- This change does not redesign the homepage layout or card styling.
- This change does not add a new AI chat surface.
- This change does not make AI responsible for time-zone or time-period classification.
- This change does not require LangGraph; the generation is a single bounded rewrite with no multi-turn state, tool routing, or node workflow.
- P1 fields such as recent highlights, recent notes, chapter summary, and user memory may be represented as optional inputs but do not need full retrieval coverage in the first implementation unless existing helpers make it low-risk.

## Decisions

### Backend-owned timeMood

Implement `getTimeMood(hour)` in a server-side module, with fixed mappings:

- 清晨: 05:00-08:59
- 上午: 09:00-11:59
- 中午: 12:00-13:59
- 下午: 14:00-17:59
- 夜晚: 18:00-21:59
- 深夜: 22:00-04:59

The API should prefer an explicit client-provided hour/timezone only if the app has no reliable server-side user timezone. Otherwise it uses the request-time local/server timezone consistently. The AI receives the resulting `timeMood` object and must not choose or modify the period.

Alternatives considered:

- Let AI infer the period from timestamps. Rejected because it violates deterministic product behavior and makes cache keys unstable.
- Hard-code only frontend time periods. Rejected because the API and cache must share one authoritative period key.

### API and cache flow

Add `GET /api/author-status`:

1. Authenticate the user.
2. Determine `card_date` and `timeMood`.
3. Look up `author_status_cards` by `user_id`, `card_date`, and `time_period`.
4. If found, return cached card with `from_cache: true`.
5. If not found, load the latest reading context from `reading_behavior_events`, ready `books`, and `chapters`.
6. Generate or fallback card content.
7. Insert generated content into `author_status_cards`.
8. Return the card with `from_cache: false`.

The cache table should include nullable `book_id`, `chapter_id`, and `source_summary` so later changes can audit what context shaped the output without storing raw long text.

Alternatives considered:

- Cache in memory. Rejected because serverless/runtime restarts would call AI repeatedly and would not satisfy per-user/day/period uniqueness.
- Cache by book only. Rejected because the core behavior is time-period-specific and must change when the period changes.

### Reading context source

Use the most recent user-owned ready book with recent reading behavior. Prefer latest `progress_saved`, then latest `chapter_viewed` or `reader_opened`. Join against `books` and `chapters` to construct:

- `book_title`
- `chapter_title`
- `progress` as a percentage if paragraph/chapter counts allow it, otherwise a compact chapter/paragraph position
- `last_read_at`

If no reading behavior exists, fall back to the newest ready bookshelf book when available, and otherwise use period-only fallback copy. The API must not fail because a user has no reading history.

### AI generation and validation

Use the existing server-side DeepSeek helper for a single JSON-only generation call. The prompt must include:

- The fixed system prompt for the author status card generator.
- The backend-provided `timeMood`.
- Available reading context and empty arrays for unavailable optional fields.
- Explicit prohibitions against inventing books, chapters, highlights, or notes.

Validate parsed JSON before caching:

- `woolf_status`: 25-50 Chinese characters where practical, starts with "她", no "我", no direct user commands.
- `thought_title`: 4-8 characters where practical.
- `thought_body`: 60-120 Chinese characters where practical, first-person Woolf voice with "我" allowed/preferred, not third-person description.
- `cta_hint`: uses backend `cta` unless reading context justifies "继续阅读" or "进入阅读"; night can keep "Ask Woolf"; no-record fallback can use "开始阅读".

If parsing or validation fails, return the deterministic fallback for the current period and do not cache invalid AI text as generated content. It is acceptable to cache deterministic fallback only if the implementation marks `source_summary` accordingly.

### Frontend integration

Convert the homepage author status card to fetch `/api/author-status` client-side or via a small client wrapper while retaining the current rendered card shell. Loading and error states should keep the existing static/default copy and buttons available. Only these fields are dynamic:

- Woolf status sentence after `Wloof:`
- Thought title
- Thought body
- Primary CTA label when applicable

The secondary `Ask Woolf` action should remain available and route to the same selected book when possible.

## Risks / Trade-offs

- [Risk] Existing localStorage reading progress may be more precise than `reading_behavior_events`. → Mitigation: use persisted reading behavior for server context now; optionally let the homepage pass a client hint later, but do not make cache correctness depend on localStorage.
- [Risk] Supabase migration may not yet be applied in local/dev environments. → Mitigation: catch missing-table errors and return fallback API content instead of crashing the homepage.
- [Risk] AI output may mix voices or invent context. → Mitigation: strict prompt, JSON parsing, field validation, and deterministic fallback.
- [Risk] Caching by day/period means changes in reading context inside the same period may not immediately update the card. → Mitigation: this is intentional to avoid repeated AI calls; new period creates a new card.
- [Risk] Server timezone may differ from user timezone. → Mitigation: support explicit hour/timezone input from the frontend if no user timezone setting exists.

## Migration Plan

1. Add `author_status_cards` table, indexes, unique constraint, and RLS policies to `supabase/schema.sql`.
2. Update generated Supabase types or manually extend type definitions consistently with project practice.
3. Implement backend helper modules for timeMood, context loading, fallback copy, AI generation, validation, and cache persistence.
4. Add `GET /api/author-status`.
5. Update homepage card data loading while preserving current visual classes.
6. Run typecheck/build and focused tests for time periods, cache behavior, no-record fallback, AI failure fallback, and frontend rendering.

Rollback: remove the frontend fetch path and return to static `getAuthorStatusCardContent`; the new cache table can remain unused.

## Open Questions

- Whether the project should later persist a user timezone preference in reading settings instead of relying on browser-provided hour/timezone hints.
- Whether fallback results should be cached when AI fails, or returned uncached so a later refresh in the same period can retry generation.
