## Context

The selected-text AI workflow currently has a boolean academic-tool decision inside `runSelectionAiWorkflow`. That boolean is derived from academic trigger detection and is evaluated after the LangGraph workflow has already loaded context, retrieved book evidence, and classified answer intent.

Recent Chinese-source provider work added fast background leads and stricter source display classes, but the workflow still needs a clearer routing layer. A simple "use academic tool" boolean is too coarse for four different cases:

- ordinary book-local explanation or reflection
- fast named-entity background lookup
- bibliography or publication metadata lookup
- full academic evidence retrieval

The new gate is a product and performance control, not a replacement for trusted-source validation. It decides which external retrieval path, if any, is allowed for this selected-text turn.

## Goals / Non-Goals

**Goals:**

- Add a deterministic, lightweight search-intent decision before provider retrieval.
- Avoid external provider calls for simple book-local questions and reflective prompts.
- Route "what is / who is / what does this mean" questions to a fast background-lead path.
- Route explicit source-backed academic questions to the existing full academic workflow.
- Preserve evidence-tier rules: background leads, bibliography records, and academic evidence must not be mixed.
- Make timeout budgets and provider scopes visible in debug logs.
- Keep ordinary answer generation responsive even when academic retrieval is slow.

**Non-Goals:**

- Do not add a new LLM classifier for search intent in this change.
- Do not add new external providers.
- Do not change the core reader UI layout.
- Do not weaken academic-source validation or allow encyclopedia pages to become academic evidence.
- Do not modify database schema.

## Decisions

### Use rule-first search intent classification

Introduce a small `SearchIntentDecision` layer with:

```ts
type SearchIntentMode = "none" | "background_lead" | "bibliography" | "academic_evidence";

type SearchIntentDecision = {
  mode: SearchIntentMode;
  reason: string;
  maxWaitMs: number;
  allowedProviders: string[];
};
```

Rules are preferred over a new model call because the gate exists to reduce latency. A model-based classifier would add another network-dependent step before the answer.

### Split background leads from full academic retrieval

`background_lead` mode should use the existing fast Wikipedia/background-provider path and a short timeout. It must not run academic keyword generation or the full academic recommendation workflow.

`academic_evidence` mode should keep the existing academic workflow, including keyword generation, provider retrieval, candidate validation, and source display policy.

### Treat bibliography as a distinct mode

`bibliography` mode is reserved for questions about editions, publication identity, ISBN, library records, or book existence. It may use bibliographic providers when available, but returned records must display as book or publication metadata and must not become scholar opinions.

### Keep answer generation resilient

The selected-text AI answer should not wait indefinitely for source retrieval. If a retrieval path exceeds its wait budget, it returns empty source arrays and lets the main answer continue. Fast background leads that arrive in time may be included even if full academic retrieval is skipped or times out.

### Log the routing decision

In development and server logs, record at least:

- selected mode
- reason
- max wait time
- allowed provider ids
- whether the full academic workflow was skipped

This is required for manual validation because the visible answer may look similar while the runtime route differs.

## Risks / Trade-offs

- Rule patterns may miss some ambiguous user phrasing. → Keep the first implementation conservative: unclear requests default to `none` unless explicit search intent is present.
- Some users may expect "是什么" to always include a source. → Background questions can still use fast background leads, but failure must degrade to normal book-local answering or an insufficient-evidence message without fabricating sources.
- Bibliography routing may have few results without credentials. → Empty bibliography results must not block answers or be presented as academic opinions.
- Debug logging can become noisy. → Log compact structured messages only around the gate and provider path selection.
