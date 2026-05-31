## 1. Intent Gate

- [x] 1.1 Add deterministic extraction for short background entities from `X是什么 / X是谁 / X什么意思` question patterns.
- [x] 1.2 Extend `SearchIntentDecision` with an optional preferred `searchEntity`.
- [x] 1.3 Classify background questions with valid question-derived entities as `background_lead` even when `selectedText` is long.
- [x] 1.4 Preserve `academic_evidence`, `bibliography`, and `none` priority behavior.

## 2. Background Lookup

- [x] 2.1 Pass the preferred `searchEntity` from selection workflow into fast background lookup.
- [x] 2.2 Prioritize `searchEntity` over long `selectedText` in first-pass background provider keywords.
- [x] 2.3 Keep source-lead validation and background-only display policy unchanged.
- [x] 2.4 Keep rewrite fallback behavior for no-result background lookups.

## 3. Tests

- [x] 3.1 Add tests for long selected text plus `百年大战是什么` routing to `background_lead`.
- [x] 3.2 Add tests for long selected text plus `克吕泰涅斯特拉是谁` routing to `background_lead`.
- [x] 3.3 Add tests proving academic/source-backed questions still route to `academic_evidence`.
- [x] 3.4 Add tests proving fast background lookup searches the question-derived entity first.
- [x] 3.5 Add tests proving ambiguous background phrases without a short entity still avoid external search.

## 4. Verification

- [x] 4.1 Run `npm run test:academic-recommendations`.
- [x] 4.2 Run `npx tsc --noEmit`.
- [x] 4.3 Run `npm run build`.
- [x] 4.4 Run `openspec validate extract-background-entity-from-question --strict`.

## 5. Source Lead Limits

- [x] 5.1 Limit fast `background_lead` lookups to at most two background leads.
- [x] 5.2 Limit `academic_evidence` attached background lookup to at most one background lead.
- [x] 5.3 Limit final answer prompt source-lead context to at most two leads without changing evidence policy.

## 6. Academic Keyword Intent Fixes

- [x] 6.1 Prevent explicit scholarly/source-backed questions from falling back to `named_entity_background`.
- [x] 6.2 Extract the explicit user topic from academic questions before using long selected text.
- [x] 6.3 Add historical keyword variants for `18世纪伦敦` style questions.
- [x] 6.4 Add regression tests for academic intent and keyword generation with mismatched selected text context.
