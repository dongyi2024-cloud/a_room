## Why

Selection AI currently decides academic retrieval with a broad boolean gate after the workflow has already started. This can make simple reading questions pay for slow external-source work, while background questions and source-backed academic questions need different provider scopes, wait budgets, and display behavior.

## What Changes

- Add a lightweight, rule-first search intent gate for selected-text AI requests before external provider retrieval is considered.
- Replace the single "use academic tool" decision with a ranked search intent mode:
  - `none`
  - `background_lead`
  - `bibliography`
  - `academic_evidence`
- Record a structured decision with `reason`, `maxWaitMs`, and `allowedProviders`.
- Ensure simple book-local questions, reflections, and interpretive questions do not call external search providers.
- Ensure "what is / who is / what does this mean" background questions use a fast background-lead path and do not run the full academic keyword workflow.
- Ensure explicit source-backed requests such as "权威来源", "学者观点", "论文", "研究支撑", or "数据支撑" are the only selected-text turns that run the full academic retrieval workflow.
- Ensure slow academic retrieval does not block ordinary answer generation or discard already available fast background leads.
- Add debug logs showing the selected search intent mode, reason, wait budget, and allowed providers.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `academic-association-recommendations`: replace boolean academic tool gating with source-intent modes and provider/wait-budget policy.
- `selection-ai-panel`: require ordinary selected-text AI questions to avoid external search latency and preserve responsive answer generation.

## Impact

- Affected server workflow:
  - `lib/ai/selection-workflow.ts`
  - `lib/academic-recommendations/background-leads.ts`
  - `lib/academic-recommendations/workflow.ts`
  - `lib/academic-recommendations/provider-runtime.ts`
- Affected behavior:
  - selected-text AI request routing
  - academic provider selection
  - fast background source leads
  - timeout and fallback behavior
  - debug logging
- No new third-party dependency is expected.
- No database schema change is expected.
