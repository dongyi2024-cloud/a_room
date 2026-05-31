## Why

Selected-text AI questions such as `百年大战是什么` or `克吕泰涅斯特拉是谁` can be classified as `none` when the selected passage is long, because the current search intent gate only treats short `selectedText` as a searchable background entity. This prevents Wikipedia/background providers from running even though the user question itself contains a clear entity.

## What Changes

- Extract a short background entity from user questions that match `X是什么`, `X是谁`, `X什么意思`, or similar patterns.
- Allow `background_lead` routing when the extracted question entity is searchable, even if `selectedText` is a full sentence or paragraph.
- Use the extracted entity as the first fast background lookup term before falling back to selected-text/context terms.
- Preserve current behavior for simple book-local questions, reflections, and ambiguous prompts.
- Preserve existing source policy: Wikipedia/Baike results remain background leads only and never become academic evidence.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `selection-ai-panel`: selected-text AI background questions can trigger fast background lookup based on an entity extracted from the question text, not only from `selectedText`.
- `academic-association-recommendations`: fast background lookup can prioritize a question-derived entity as provider search input while preserving background-lead display policy.

## Impact

- Affected server code:
  - `lib/academic-recommendations/search-intent.ts`
  - `lib/academic-recommendations/background-leads.ts`
  - `types/academic-recommendations.ts`
- Affected tests:
  - `scripts/test-academic-recommendations.mjs`
- No database schema change.
- No new external provider.
- No UI layout change.
