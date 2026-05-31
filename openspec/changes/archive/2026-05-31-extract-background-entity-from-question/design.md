## Context

The selection AI flow already has a search intent gate that prevents ordinary book-local questions from paying the cost of external provider lookup. For background questions, the gate currently requires `selectedText` to look like a short entity. That works when the user selects only `西多会`, but fails when the user selects a longer passage and asks `百年大战是什么` or `苔丝狄蒙娜是谁`.

The fast background provider path also builds its initial provider query from `selectedText`, so even if routing is allowed, a long selected passage can pollute the first search term.

## Goals / Non-Goals

**Goals:**

- Extract a short searchable entity from background-style user questions.
- Route `X是什么 / X是谁 / X什么意思` to `background_lead` when `X` is a plausible short entity.
- Prioritize the extracted entity in fast background provider search terms.
- Keep deterministic rule-based routing; do not add a new model classifier.
- Preserve existing background-lead-only display policy.

**Non-Goals:**

- Do not broaden every background phrase into external search.
- Do not use extracted entities for academic evidence or scholar viewpoint generation.
- Do not add new providers.
- Do not change frontend rendering.
- Do not alter the full academic workflow for explicit academic/source-backed questions.

## Decisions

### Extract entity from question before falling back to selected text

Add a small deterministic extractor for question patterns such as:

- `X是什么`
- `X是啥`
- `X是谁`
- `X什么意思`
- `什么是X`
- `啥是X`

The extracted term is sanitized and checked with the existing short-entity predicate. If valid, the search intent becomes `background_lead` even if `selectedText` is long.

### Carry the extracted entity into background lookup

The intent decision should expose an optional `searchEntity` so downstream background lookup can prefer it over long selected text. This keeps provider search focused without changing provider APIs.

### Keep conservative fallback behavior

If no valid question entity exists, the current behavior remains unchanged. Ambiguous questions still default to `none`.

## Risks / Trade-offs

- False positives from broad question patterns → Mitigation: keep max length and searchable-entity validation strict.
- Entity aliases may still be missing → Mitigation: the existing background rewrite fallback can expand aliases after first-pass no-result.
- Explicit academic questions containing `是什么` may be routed incorrectly → Mitigation: academic evidence patterns continue to run before background extraction.
