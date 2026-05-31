## ADDED Requirements

### Requirement: Background lead retrieval SHALL support bounded query rewrite fallback
The system SHALL support a bounded query rewrite fallback when a selected-text AI request is classified as `background_lead` and the first fast background lookup returns no usable background leads.

#### Scenario: First pass succeeds without rewrite
- **WHEN** a `background_lead` question returns at least one verified background lead from the first provider search
- **THEN** the system returns those leads without calling the query rewrite fallback

#### Scenario: First pass has no background lead
- **WHEN** a `background_lead` question returns no usable background lead from the first provider search
- **THEN** the system may invoke query rewrite using the selected text, user question, current paragraph, chapter title, and book title
- **AND** the rewritten terms are searched only against providers allowed for `background_lead`

#### Scenario: Translated literary name expands search terms
- **WHEN** the user asks who `苔丝狄蒙娜` is and the first background search has no usable result
- **THEN** the rewrite fallback may generate search terms such as `苔丝狄蒙娜`, `黛丝德蒙娜`, `Desdemona`, or `奥赛罗 Desdemona`
- **AND** any returned source still must pass background-lead validation before display

#### Scenario: Classical or mythological name expands safely
- **WHEN** the user asks who `克吕泰涅斯特拉` is and the first background search has no usable result
- **THEN** the rewrite fallback may generate alternate Chinese or original-language search terms such as `Clytemnestra`
- **AND** those terms are used only as search input

### Requirement: Query rewrite output SHALL be structured and non-authoritative
The system SHALL treat background query rewrite output as non-authoritative search input only.

#### Scenario: Rewrite result contains bounded search terms
- **WHEN** the query rewrite fallback succeeds
- **THEN** the result contains at most five sanitized search terms
- **AND** each term is short, deduplicated, and safe to pass to background providers

#### Scenario: Rewrite tries to produce source facts
- **WHEN** the query rewrite output includes paper titles, scholar names, URLs, citations, source metadata, factual claims, or final answer prose
- **THEN** the system ignores those fields
- **AND** it does not treat them as evidence, answer content, or displayable source information

#### Scenario: Rewrite fails or times out
- **WHEN** the query rewrite fallback fails, times out, returns malformed JSON, or produces no valid terms
- **THEN** the system falls back to deterministic search terms or returns no background leads
- **AND** it does not fabricate source leads

### Requirement: Background rewrite SHALL preserve source policy
The system SHALL preserve existing source policy and evidence-tier rules for all results found through rewritten background queries.

#### Scenario: Rewritten term finds encyclopedia result
- **WHEN** a rewritten term finds a Wikipedia, Baidu Baike, or similar encyclopedia result
- **THEN** the result may be displayed only as a background lead
- **AND** it MUST NOT be displayed as academic evidence, scholar viewpoint, or paper recommendation

#### Scenario: Rewritten term finds no verified result
- **WHEN** rewritten terms do not produce a verified background lead
- **THEN** the system returns no background lead for that turn
- **AND** the answer generator receives no fabricated external source

### Requirement: Background rewrite SHALL be observable
The system SHALL log compact routing and fallback information for background query rewrite in development/server logs.

#### Scenario: Rewrite fallback is attempted
- **WHEN** the system attempts background query rewrite
- **THEN** the logs include first-pass result count, sanitized rewrite terms, and fallback result count

#### Scenario: Rewrite fallback is skipped
- **WHEN** first-pass background lookup succeeds or the search intent mode is not `background_lead`
- **THEN** the logs indicate that rewrite was skipped or do not emit rewrite-attempt logs for that turn
