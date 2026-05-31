## Purpose

Define selected-text AI panel behavior, including explanation modes, grounded citations, and source navigation from AI answers.
## Requirements
### Requirement: Selected-text AI panel SHALL support explanation mode switching
The system SHALL let the reader choose between plain-language explanation and closer-to-original explanation inside the selected-text AI panel.

#### Scenario: Reader switches explanation mode
- **WHEN** the reader changes the explanation mode in the selected-text AI panel
- **THEN** the next selected-text AI answer uses the newly selected mode

#### Scenario: Mode remains visible and persists on reopen
- **WHEN** the reader closes and later reopens the selected-text AI panel on the same device
- **THEN** the system restores the most recently chosen explanation mode for that reader-facing panel
- **AND** the active mode is clearly visible in the UI

### Requirement: Selected-text AI panel SHALL render grounded citations beneath each answer
The system SHALL render citations for each selected-text AI answer when grounded evidence is available.

#### Scenario: Answer shows citation list
- **WHEN** the selected-text AI workflow returns one or more citations for an answer
- **THEN** the panel displays those citations beneath the corresponding answer turn
- **AND** each rendered citation shows the cited book and chapter information

#### Scenario: No-evidence answer does not show fake citations
- **WHEN** the selected-text AI workflow returns an answer with no usable grounding evidence
- **THEN** the panel shows no fabricated citation item for that answer turn

### Requirement: Selected-text AI citations SHALL jump back to the cited paragraph range
The system SHALL let the reader jump from a rendered selected-text AI citation back to the cited paragraph location in the reader.

#### Scenario: Citation click returns reader to source paragraph
- **WHEN** the reader activates a citation under a selected-text AI answer
- **THEN** the reader scrolls or jumps to the cited paragraph range in the current book
- **AND** the reader can continue reading from that source location

### Requirement: Selected-text AI answers can receive user feedback
The system SHALL provide a feedback action for completed selected-text AI answer turns.

#### Scenario: Feedback action appears after AI answer
- **WHEN** a selected-text AI answer finishes successfully
- **THEN** the answer surface offers a restrained feedback action

#### Scenario: User submits AI answer feedback
- **WHEN** the user submits feedback for a selected-text AI answer with a supported feedback type
- **THEN** the system creates a feedback record targeting the AI answer context

#### Scenario: Feedback includes safe answer context
- **WHEN** AI answer feedback is stored
- **THEN** the record includes safe context such as book id, chapter order, paragraph order, question or turn key, answer excerpt, citation count, and feedback type

#### Scenario: Feedback failure does not break AI panel
- **WHEN** AI answer feedback submission fails
- **THEN** the AI answer remains visible and the panel shows a bounded failure message

### Requirement: Selected-text AI panel SHALL avoid external search latency for ordinary questions
The system SHALL keep ordinary selected-text AI questions responsive by not waiting on external source providers unless the request has a clear external search intent.

#### Scenario: Simple explanation does not wait for providers
- **WHEN** the reader asks a simple selected-text explanation question that does not request background, bibliography, authoritative sources, scholar viewpoints, papers, research, or data support
- **THEN** the selected-text AI answer is generated from book-local context and retrieved book evidence only
- **AND** the answer does not wait for external source providers

#### Scenario: Reflective prompt does not wait for providers
- **WHEN** the reader asks for a feeling, reflection, or short interpretive response about the selected text
- **THEN** the selected-text AI answer does not call external source providers
- **AND** the panel remains responsive on PC and mobile

#### Scenario: Slow academic path does not remove fast source leads
- **WHEN** a selected-text AI question has fast background source leads available
- **AND** a slower source path is skipped, disabled, unavailable, or times out
- **THEN** the panel may still display the verified fast background leads returned within budget
- **AND** it does not discard those leads because the full academic path is unavailable

### Requirement: Selected-text AI panel SHALL remain responsive when background rewrite is unavailable
The system SHALL keep selected-text AI answer generation responsive when background query rewrite is unavailable, fails, or times out.

#### Scenario: Rewrite unavailable
- **WHEN** a `background_lead` question has no first-pass background result
- **AND** the query rewrite service is not configured or unavailable
- **THEN** the selected-text AI workflow continues without rewritten source leads
- **AND** it does not expose internal rewrite errors to the reader

#### Scenario: Rewrite times out
- **WHEN** the query rewrite fallback exceeds its configured short timeout
- **THEN** the selected-text AI workflow treats the fallback as empty
- **AND** answer generation is not blocked beyond the configured wait budget

#### Scenario: Ordinary question does not rewrite
- **WHEN** the selected-text AI search intent mode is `none`, `bibliography`, or `academic_evidence`
- **THEN** the background query rewrite fallback is not invoked for that turn

### Requirement: Selection search intent SHALL extract background entities from questions
The selection AI search intent gate SHALL classify clear `X是什么`, `X是谁`, or `X什么意思` questions as `background_lead` when the user question contains a valid short searchable entity, even if the selected text is a longer sentence or paragraph.

#### Scenario: Who question contains searchable entity
- **WHEN** the user selects a long passage and asks `克吕泰涅斯特拉是谁`
- **THEN** the search intent mode is `background_lead`
- **AND** the allowed providers include background providers such as Wikipedia

#### Scenario: What question contains historical entity
- **WHEN** the user selects a long passage and asks `百年大战是什么`
- **THEN** the search intent mode is `background_lead`
- **AND** the decision exposes `百年大战` as the preferred background search entity

#### Scenario: Ambiguous background phrase has no entity
- **WHEN** the user asks a background-style question that does not contain a valid short searchable entity
- **THEN** the search intent may remain `none`
- **AND** external provider search is not required

#### Scenario: Academic request still takes priority
- **WHEN** the user asks for academic support, scholar viewpoints, papers, or authoritative sources
- **THEN** the search intent remains `academic_evidence`
- **AND** question-entity extraction does not downgrade it to `background_lead`

### Requirement: Selection AI SHALL degrade gracefully on malformed answer JSON
The selected-text AI workflow SHALL avoid returning a route-level 500 solely because the answer model returned malformed grounded-answer JSON.

#### Scenario: Malformed JSON contains usable answer text
- **WHEN** the answer model returns non-JSON or malformed JSON with usable answer text
- **THEN** the workflow uses that text as the answer fallback
- **AND** the fallback citation list is empty
- **AND** no raw internal parse error is exposed to the reader

#### Scenario: Malformed JSON has no usable answer text
- **WHEN** the answer model returns malformed output without usable answer text
- **THEN** the workflow returns a stable insufficient-evidence style answer
- **AND** the route does not fail only because of JSON parsing

#### Scenario: Strict grounded fallback has no support
- **WHEN** strict-grounded mode receives fallback text with no valid citations and no verified external sources
- **THEN** the existing insufficient-evidence behavior still applies
- **AND** the workflow does not fabricate citation IDs

#### Scenario: Valid JSON still follows normal path
- **WHEN** the answer model returns valid grounded-answer JSON
- **THEN** the workflow parses and handles it using the existing normal path

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

