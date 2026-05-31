## ADDED Requirements

### Requirement: Selection AI SHALL use a faster default answer path
The selected-text AI workflow SHALL prioritize fast book-local answers and bounded background leads over slow full academic retrieval.

#### Scenario: Full academic workflow is paused
- **WHEN** the selection search intent is `academic_evidence`
- **THEN** the selection AI workflow does not call the full academic recommendation workflow
- **AND** it does not block the answer on academic provider retrieval

#### Scenario: Background leads remain available
- **WHEN** the selection search intent is `background_lead`
- **THEN** the workflow may run fast background lead lookup
- **AND** the lookup uses a short timeout and a small max result limit

#### Scenario: Prompt context is bounded
- **WHEN** the workflow builds final answer context
- **THEN** it uses fewer retrieved chunks and shorter chunk snippets than the previous default

#### Scenario: Malformed JSON does not trigger retry call
- **WHEN** the answer model returns malformed grounded-answer JSON
- **THEN** the workflow uses the fallback parser
- **AND** it does not issue a second model call solely to repair JSON formatting

### Requirement: Selection AI SHALL preserve evidence policy while fast path is active
The selected-text AI workflow SHALL NOT present background leads as academic evidence while full academic retrieval is paused.

#### Scenario: User asks for scholarly support
- **WHEN** the user asks for literature support, papers, scholars, or authoritative academic sources
- **THEN** the workflow does not fabricate academic recommendations
- **AND** any background leads remain non-academic source leads only
