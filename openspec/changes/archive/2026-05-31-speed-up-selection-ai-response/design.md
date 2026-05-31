## Context

The selection AI workflow currently supports background leads, bibliography leads, and full academic evidence retrieval. In practice, full academic retrieval is slow and often lacks reliable Chinese academic evidence. The final answer model call can also be slow due to large prompt context and JSON retry calls.

## Goals / Non-Goals

**Goals:**

- Reduce common selected-text answer latency.
- Keep book-local RAG and fast background leads.
- Pause full academic retrieval from the selection AI path.
- Keep malformed JSON fallback but avoid an extra retry model call.
- Preserve source policy: background leads do not become academic evidence.

**Non-Goals:**

- Do not delete academic provider code.
- Do not change frontend rendering.
- Do not add new providers.
- Do not solve academic source coverage in this change.

## Decisions

### Pause full academic workflow in selection AI

When search intent is `academic_evidence`, selection AI should not call `runAcademicRecommendationWorkflow`. It may still use a small fast background lookup if the question also has a searchable background entity, but otherwise it returns no academic recommendations and no slow external academic evidence.

### Shrink prompt and answer budget

Lower RAG `topK`, per-chunk characters, and default answer max tokens to reduce prompt size and model generation time.

### Fallback instead of JSON retry

The strict JSON call remains, but malformed output is handled by the fallback extractor added in the previous hardening change. This avoids a second model call just to repair JSON.

## Risks / Trade-offs

- Users asking for literature support will not receive true academic evidence while full academic workflow is paused -> The answer should avoid claiming scholarly support.
- Fewer RAG chunks may miss some context -> The route remains faster and can still retrieve chapter-scoped chunks for directional questions.
- No JSON retry may return fallback text more often -> It avoids route-level slow failures and still fabricates no citations.
