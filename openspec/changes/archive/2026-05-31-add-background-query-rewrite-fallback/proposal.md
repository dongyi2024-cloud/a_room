## Why

Fast background lookup currently relies mostly on the selected text and simple rule-derived search terms. Chinese literary names, translated character names, and allusions such as `苔丝狄蒙娜` may fail to match a provider entry unless the query is expanded to alternate translations, original names, or work context.

## What Changes

- Add a bounded background query rewrite fallback for selected-text AI questions classified as `background_lead`.
- Keep the existing fast provider search as the first attempt.
- Invoke query rewrite only when the initial fast background search returns no usable background leads.
- Use the selected text, user question, current paragraph, chapter title, and book title to generate a short list of search terms.
- Limit the rewrite output to safe search terms only; it MUST NOT create source metadata, claims, scholar viewpoints, paper titles, URLs, or final answer content.
- Keep the fallback short-timeout and non-blocking so ordinary answers do not become slow.
- Preserve existing source validation and display policy: rewritten terms are search input only, not evidence.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `academic-association-recommendations`: add a background-lead query rewrite fallback for no-result background searches.
- `selection-ai-panel`: preserve responsive selected-text AI behavior when background query rewrite is unavailable, times out, or returns no usable search terms.

## Impact

- Affected server workflow:
  - `lib/academic-recommendations/background-leads.ts`
  - `lib/academic-recommendations/provider-runtime.ts`
  - `lib/ai/selection-workflow.ts`
  - `lib/ai/deepseek.ts` usage through a new bounded rewrite helper
- Affected tests:
  - `scripts/test-academic-recommendations.mjs`
- No database schema change is expected.
- No new external provider is expected.
- No UI layout change is expected.
