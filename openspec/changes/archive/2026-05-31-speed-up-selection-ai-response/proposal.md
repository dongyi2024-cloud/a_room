## Why

Selected-text AI answers can take too long because the route may run full academic retrieval, wait on external providers, send large book-evidence prompts, and retry malformed JSON with another model call. The product should prioritize fast, stable reading assistance while full scholarly retrieval is paused.

## What Changes

- Disable the full academic workflow in selection AI for now.
- Keep fast Wikipedia/background leads for `是什么 / 是谁` style questions.
- Lower fast background lookup timeout to 1500ms while keeping max source leads at 1-2.
- Reduce book RAG prompt size by lowering retrieval topK and per-chunk prompt characters.
- Reduce default answer generation token budget.
- Stop doing a second model call solely for grounded-answer JSON retry; use existing fallback handling instead.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `selection-ai-panel`: selected-text AI answer generation should use a faster default path that avoids blocking on full academic retrieval and minimizes prompt/model retry cost.
- `academic-association-recommendations`: selection AI should keep background leads while pausing full academic recommendation retrieval.

## Impact

- Affected server workflow:
  - `lib/ai/selection-workflow.ts`
  - `lib/academic-recommendations/background-leads.ts`
- Affected tests:
  - `scripts/test-academic-recommendations.mjs`
- No database schema change.
- No UI layout change.
- Academic provider implementation remains in place but is not used by selection AI while this fast path is active.
