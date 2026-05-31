## ADDED Requirements

### Requirement: Selection AI SHALL classify external search intent into bounded modes
The system SHALL classify selected-text AI requests into a structured external search intent before invoking external source providers.

#### Scenario: Ordinary book-local question selects no external search
- **WHEN** the user asks a simple explanation, interpretation, reflection, or "write feelings" question without requesting external background, bibliography, authority, source, research, scholar, paper, or data support
- **THEN** the search intent mode is `none`
- **AND** the system does not call external academic, bibliography, encyclopedia, or archive providers for that turn

#### Scenario: Named entity background question selects fast background mode
- **WHEN** the user asks what a selected person, organization, concept, historical term, religious group, or proper noun is
- **THEN** the search intent mode is `background_lead`
- **AND** the decision includes a short `maxWaitMs`
- **AND** the allowed providers are limited to background-lead providers

#### Scenario: Bibliography question selects bibliography mode
- **WHEN** the user asks about book identity, edition, ISBN, publication record, publisher record, library record, or catalog information
- **THEN** the search intent mode is `bibliography`
- **AND** the allowed providers are limited to bibliographic or publication metadata providers

#### Scenario: Explicit source-backed question selects academic evidence mode
- **WHEN** the user explicitly requests authoritative sources, scholar viewpoints, academic support, papers, research, source evidence, provenance, or data support
- **THEN** the search intent mode is `academic_evidence`
- **AND** the full trusted academic retrieval workflow is allowed within its configured timeout

#### Scenario: Ambiguous question defaults to no external search
- **WHEN** the user question does not clearly match a background, bibliography, or academic-evidence intent
- **THEN** the search intent mode is `none`
- **AND** the system avoids external provider latency for that turn

### Requirement: Search intent decision SHALL expose routing metadata
The system SHALL represent every selected-text AI external-search decision with auditable routing metadata.

#### Scenario: Decision contains required fields
- **WHEN** the system classifies selected-text AI search intent
- **THEN** the decision includes `mode`, `reason`, `maxWaitMs`, and `allowedProviders`

#### Scenario: Routing decision is logged
- **WHEN** the selected-text AI workflow handles a question
- **THEN** the server logs a compact debug entry with the selected mode, reason, wait budget, and allowed provider ids

### Requirement: Background search mode SHALL avoid full academic keyword generation
The system SHALL keep fast background-lead lookup separate from full academic keyword generation and academic evidence retrieval.

#### Scenario: What-is question uses fast background leads only
- **WHEN** the search intent mode is `background_lead`
- **THEN** the system may query configured background-lead providers within the fast wait budget
- **AND** it does not run the full academic keyword generation node
- **AND** it does not run the full academic recommendation workflow

#### Scenario: Background lead remains non-academic
- **WHEN** a background provider returns a verified encyclopedia or background result
- **THEN** the result may be displayed as a background lead
- **AND** it MUST NOT be displayed as a scholar viewpoint, paper recommendation, or academic conclusion

### Requirement: Bibliography search mode SHALL remain separate from academic opinions
The system SHALL handle bibliography and publication metadata searches without converting their results into academic opinions.

#### Scenario: Bibliography result displays as book metadata
- **WHEN** the search intent mode is `bibliography`
- **AND** a bibliographic provider returns a verified record
- **THEN** the result may be displayed as bibliography, publication, edition, or catalog information
- **AND** it MUST NOT be displayed as `学者认为`, `学界认为`, a paper recommendation, or an academic conclusion

#### Scenario: Bibliography provider unavailable
- **WHEN** bibliography mode is selected but configured bibliography providers are disabled, unavailable, or time out
- **THEN** the system returns no bibliography source for that turn
- **AND** answer generation continues without fabricated bibliography records

## MODIFIED Requirements

### Requirement: Selection AI SHALL use academic retrieval as an intent-gated bounded tool for source-backed questions
The system SHALL make verified academic retrieval available to the selection AI answer generator only when the structured search intent mode is `academic_evidence`.

#### Scenario: Source-backed question is classified for academic tool use
- **WHEN** the user asks a selected-text question that explicitly requests authoritative sources, scholarly support, data support, source evidence, or reliable provenance
- **THEN** the selection workflow classifies the request with search intent mode `academic_evidence`
- **AND** it attempts full academic retrieval before answer generation within the configured academic wait budget
- **AND** the answer generator may use only verified academic recommendations returned by trusted providers as external support

#### Scenario: Ordinary reading question skips academic tool use
- **WHEN** the user asks an ordinary selected-text explanation question without academic, source-backed, background, bibliography, or authoritative-support intent
- **THEN** the selection workflow classifies the request with search intent mode `none`
- **AND** it does not invoke external source providers for that turn

#### Scenario: Background question skips full academic retrieval
- **WHEN** the user asks a selected-text named-entity or concept background question without requesting scholars, papers, research, sources, or authority support
- **THEN** the selection workflow classifies the request with search intent mode `background_lead`
- **AND** it may invoke only the fast background-lead retrieval path
- **AND** it does not invoke the full academic retrieval workflow

#### Scenario: Academic tool is bounded in the selection answer path
- **WHEN** academic retrieval is invoked from the selection AI workflow
- **THEN** the retrieval attempt is bounded by the search intent decision's wait budget so the main AI answer is not indefinitely blocked
- **AND** if no verified academic recommendation is available within the bound, the system returns no academic support instead of fabricating sources

#### Scenario: Book evidence is insufficient but verified academic sources exist
- **WHEN** the current book evidence is insufficient for a strict grounded answer
- **AND** verified academic recommendations are available for an `academic_evidence` question
- **THEN** the system may answer using the verified academic sources as external support
- **AND** it indicates that the support comes from external academic sources rather than book-local evidence
