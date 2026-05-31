## Why

The selected-text AI route can fail with HTTP 500 when the answer model returns prose, malformed JSON, or truncated JSON instead of the required grounded-answer JSON shape. This is especially painful after long retrieval workflows because the reader waits tens of seconds and receives no usable answer.

## What Changes

- Add a robust fallback for selection answer generation when strict JSON parsing fails.
- Preserve the existing first and second strict-JSON attempts.
- If strict parsing fails but the model returned usable text, wrap that text as an answer with an empty citation list.
- If no usable text exists, return the existing insufficient-evidence style response instead of throwing a route-level 500.
- Log compact diagnostic metadata for parse fallback without exposing raw model output to the reader.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `selection-ai-panel`: selected-text AI answer generation should degrade gracefully when the answer model does not return valid JSON.

## Impact

- Affected server workflow:
  - `lib/ai/selection-workflow.ts`
- Affected tests:
  - `scripts/test-academic-recommendations.mjs`
- No database schema change.
- No provider or retrieval policy change.
- No UI layout change.
