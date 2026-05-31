## 1. Runtime Limits

- [x] 1.1 Lower fast background lead default timeout to 1500ms.
- [x] 1.2 Keep fast background result count bounded at 1-2 results.
- [x] 1.3 Lower selection RAG topK from 5 to 3.
- [x] 1.4 Lower max prompt chunk characters from 600 to 420.
- [x] 1.5 Lower default answer max tokens from 420 to 300.

## 2. Workflow Shortcuts

- [x] 2.1 Pause full academic recommendation workflow from selection AI.
- [x] 2.2 Keep fast background leads available for background questions.
- [x] 2.3 Ensure academic evidence requests do not fabricate academic recommendations while full retrieval is paused.
- [x] 2.4 Remove the second model call for grounded-answer JSON retry and rely on fallback parsing.

## 3. Tests

- [x] 3.1 Update tests for the new prompt and retrieval limits.
- [x] 3.2 Add tests proving selection workflow no longer invokes full academic workflow for academic evidence requests.
- [x] 3.3 Add tests proving JSON retry prompt is no longer present.
- [x] 3.4 Keep tests proving background source leads remain non-academic.

## 4. Verification

- [x] 4.1 Run `npm run test:academic-recommendations`.
- [x] 4.2 Run `npx tsc --noEmit`.
- [x] 4.3 Run `npm run build`.
- [x] 4.4 Run `openspec validate speed-up-selection-ai-response --strict`.
