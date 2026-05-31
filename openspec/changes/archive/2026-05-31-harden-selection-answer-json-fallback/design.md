## Context

The selection AI workflow asks DeepSeek to return strict JSON with `answer` and `citationChunkIds`. The current implementation retries once with a stricter JSON instruction, then throws if parsing still fails. That exception bubbles through LangGraph and the route returns 500.

This failure mode is not a retrieval failure. The workflow may already have valid book evidence, academic recommendations, or source leads. The user should receive a degraded answer or a stable insufficient-evidence message instead of a server error.

## Goals / Non-Goals

**Goals:**

- Keep the strict JSON contract as the primary path.
- Prevent malformed model JSON from causing `/api/ai/selection` to return 500.
- Preserve strict-grounded citation enforcement: fallback text must not invent citations.
- Avoid exposing raw model output or internal parse errors to the user.
- Keep the change localized to selected-text answer generation.

**Non-Goals:**

- Do not change retrieval, provider selection, or source display policy.
- Do not loosen citation validity checks.
- Do not add another model call beyond the existing retry.
- Do not change frontend rendering.

## Decisions

### Fallback after existing JSON attempts

The workflow should still try strict JSON first and the existing stricter retry second. Only after both parse attempts fail should it use a fallback.

### Extract safe answer text from malformed output

If malformed output contains readable text, strip code fences, trim obvious JSON fragments when possible, normalize whitespace, and use it as `answer` with `citationChunkIds: []`. This allows the existing strict-grounded downstream logic to reject unsupported fallback answers when there are no external sources or citations.

### Return stable insufficient evidence when no fallback exists

If no usable text exists, the generate-answer node should return the current insufficient-evidence response rather than throwing.

## Risks / Trade-offs

- Fallback prose may be less structured than normal output -> It still passes through answer length enforcement and carries no fabricated citations.
- Empty citation fallback may suppress strict-grounded answers without external sources -> This preserves current groundedness rules.
- Some model failures may still happen outside parse fallback -> Route-level catch remains responsible for unexpected infrastructure errors.
