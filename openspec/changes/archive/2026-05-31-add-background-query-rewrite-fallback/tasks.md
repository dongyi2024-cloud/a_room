## 1. Rewrite Helper

- [x] 1.1 Add a typed background query rewrite result with bounded `searchTerms` and optional diagnostic entity type.
- [x] 1.2 Implement a prompt/helper that uses selected text, question, paragraph, chapter title, and book title to produce JSON rewrite terms.
- [x] 1.3 Add strict parsing and sanitization for rewrite output, including max term count, max term length, deduplication, URL removal, and unsupported-field ignoring.
- [x] 1.4 Add deterministic fallback terms when the rewrite model is unavailable, malformed, or times out.

## 2. Background Lead Integration

- [x] 2.1 Keep first-pass background provider search unchanged and return immediately when it finds usable background leads.
- [x] 2.2 Invoke rewrite fallback only for `background_lead` searches after first-pass no-result.
- [x] 2.3 Search rewritten terms only through background-lead providers allowed by search intent.
- [x] 2.4 Ensure rewritten-term results still pass existing source-lead validation and display only as `background_lead`.
- [x] 2.5 Ensure rewrite failures return empty source leads without blocking answer generation.

## 3. Observability

- [x] 3.1 Log first-pass background result count when background lookup runs.
- [x] 3.2 Log whether rewrite fallback was attempted or skipped.
- [x] 3.3 Log sanitized rewrite terms and fallback result count without exposing full prompts or internal model errors.

## 4. Tests

- [x] 4.1 Add tests where first-pass background lookup succeeds and rewrite is not called.
- [x] 4.2 Add tests where `苔丝狄蒙娜是谁` rewrites to alternate terms such as `Desdemona` or `奥赛罗 Desdemona`.
- [x] 4.3 Add tests where `克吕泰涅斯特拉是谁` rewrites to an alternate term such as `Clytemnestra`.
- [x] 4.4 Add tests proving rewrite output cannot become academic evidence, scholar viewpoint, source metadata, URL, or final answer content.
- [x] 4.5 Add tests proving ordinary `none` mode questions do not invoke background rewrite.
- [x] 4.6 Add tests proving rewrite timeout or malformed output degrades to empty/fallback terms without throwing.

## 5. Verification

- [x] 5.1 Run `npm run test:academic-recommendations`.
- [x] 5.2 Run `npx tsc --noEmit`.
- [x] 5.3 Run `npm run build`.
- [x] 5.4 Run `openspec validate add-background-query-rewrite-fallback --strict`.
