## 1. Search Intent Gate

- [x] 1.1 Add a typed `SearchIntentDecision` model with `mode`, `reason`, `maxWaitMs`, and `allowedProviders`.
- [x] 1.2 Implement a deterministic rule-first classifier for selected-text AI search intent.
- [x] 1.3 Cover `none`, `background_lead`, `bibliography`, and `academic_evidence` decisions with unit tests.
- [x] 1.4 Ensure ambiguous questions default to `none` unless explicit external-search intent is detected.

## 2. Selection Workflow Integration

- [x] 2.1 Replace the boolean selected-text academic-tool decision with the structured search intent decision.
- [x] 2.2 Route `none` mode so no external provider path is invoked.
- [x] 2.3 Route `background_lead` mode through fast background-source leads only.
- [x] 2.4 Route `bibliography` mode through bibliography-capable providers only when configured.
- [x] 2.5 Route `academic_evidence` mode through the existing full academic recommendation workflow.
- [x] 2.6 Ensure fast background leads are preserved even when a slower source path is skipped, unavailable, or timed out.

## 3. Provider Scope And Timeout Policy

- [x] 3.1 Apply the search intent `allowedProviders` list when selecting provider runtime adapters.
- [x] 3.2 Apply the search intent `maxWaitMs` budget to the selected retrieval path.
- [x] 3.3 Ensure `background_lead` mode does not run full academic keyword generation.
- [x] 3.4 Ensure bibliography records cannot be displayed as scholar opinions or academic conclusions.

## 4. Logging And Observability

- [x] 4.1 Log the selected search intent mode, reason, max wait time, and allowed providers in development/server logs.
- [x] 4.2 Log when full academic retrieval is skipped because the mode is `none`, `background_lead`, or `bibliography`.
- [x] 4.3 Keep logs compact and avoid exposing internal provider errors to the user.

## 5. Verification

- [x] 5.1 Add tests showing simple questions and reflective prompts do not call external providers.
- [x] 5.2 Add tests showing "是什么 / 是谁 / 什么意思" questions use fast background leads only.
- [x] 5.3 Add tests showing "权威来源 / 学者观点 / 论文 / 研究支撑 / 数据支撑" questions use full academic retrieval.
- [x] 5.4 Add tests showing bibliography questions stay in bibliography mode and do not generate scholar opinions.
- [x] 5.5 Run `npm run test:academic-recommendations`.
- [x] 5.6 Run `npx tsc --noEmit`.
- [x] 5.7 Run `npm run build`.
- [x] 5.8 Run `openspec validate add-selection-search-intent-gate --strict`.
