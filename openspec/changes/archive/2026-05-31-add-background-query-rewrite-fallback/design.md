## Context

The selected-text AI flow now has a search intent gate. `background_lead` mode is intentionally fast and does not run the full academic keyword workflow. This keeps ordinary questions responsive, but it exposes a retrieval quality gap: short Chinese translated names or literary allusions may not match Wikipedia or other background providers under the exact selected text.

Examples include translated character names where a provider may index another Chinese translation or the original English/Greek name. The system needs a fallback that can expand `苔丝狄蒙娜是谁` into safe search terms such as `苔丝狄蒙娜`, `黛丝德蒙娜`, `Desdemona`, and `奥赛罗 Desdemona`, without turning the model into an evidence generator.

## Goals / Non-Goals

**Goals:**

- Improve no-result `background_lead` lookup by generating a few contextual search terms.
- Use rewrite only after the first fast background lookup returns no usable leads.
- Keep the rewrite bounded by short timeout, max term count, and strict JSON validation.
- Treat rewritten terms only as provider search input.
- Preserve provider validation and display policy before anything reaches the answer or UI.
- Avoid slowing ordinary `none` mode and avoid running full academic keyword generation for background questions.

**Non-Goals:**

- Do not use rewrite to decide whether external search is needed.
- Do not use rewrite for every selected-text AI question.
- Do not generate answers, claims, source metadata, paper titles, scholars, URLs, or citations in the rewrite node.
- Do not add new providers or change UI layout.
- Do not bypass provider verification when rewritten terms find a result.

## Decisions

### Rewrite only as a no-result fallback

The first `background_lead` provider search remains deterministic and fast. If that returns at least one verified background lead, the system returns it immediately. Query rewrite is attempted only when the first pass has no usable lead.

This keeps the common path fast and limits model cost.

### Use a small structured rewrite result

The rewrite helper should return a bounded structure such as:

```ts
type BackgroundQueryRewriteResult = {
  searchTerms: string[];
  entityType?: "person" | "literary_character" | "place" | "organization" | "historical_event" | "concept" | "unknown";
  fallbackUsed: boolean;
};
```

Only `searchTerms` are passed to providers. `entityType` is diagnostic and must not be shown as evidence.

### Validate and sanitize model output

The rewrite parser must:

- accept only JSON object output
- keep at most 5 terms
- keep short terms only
- deduplicate case-insensitively
- remove URLs and source-like strings
- ignore any unsupported fields such as titles, scholars, claims, or references
- fall back to deterministic terms on malformed output, timeout, or model error

### Keep provider search bounded

After rewrite, the same background providers are used. The rewritten terms may be passed as provider keywords or repeated provider queries, but the result must still become an `AcademicSourceCandidate`, pass source-lead validation, and display only as `background_lead`.

### Log fallback behavior

Development/server logs should show:

- first-pass background result count
- whether rewrite was attempted
- sanitized rewrite terms
- fallback result count

The logs should not expose full prompts or internal model errors to the user.

## Risks / Trade-offs

- Rewrite consumes a model call when first-pass lookup fails. → Only run in `background_lead` mode after no-result first pass, with a short timeout.
- The model may hallucinate related terms. → Terms are treated as search input only and cannot appear as source facts unless providers return verified results.
- Alternate translations may still fail. → Fall back cleanly to empty source leads; the answer path must continue without fabricated sources.
- A 402 or model outage can affect rewrite. → Treat rewrite failure as an empty fallback and keep the main answer flow running.
