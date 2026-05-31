## ADDED Requirements

### Requirement: Fast background lookup SHALL prioritize question-derived entities
Fast background lookup SHALL use a validated entity extracted from the user question as the preferred provider search term when present.

#### Scenario: Long selected text with question entity
- **WHEN** the selected text is long and the user asks `百年大战是什么`
- **THEN** the first background provider search includes `百年大战`
- **AND** it does not rely only on the full selected passage

#### Scenario: Question-derived entity finds encyclopedia lead
- **WHEN** a question-derived entity finds a Wikipedia or encyclopedia result
- **THEN** the result may be displayed only as a background lead
- **AND** it MUST NOT be displayed as academic evidence, scholar viewpoint, or paper recommendation

#### Scenario: No usable result after entity search
- **WHEN** the question-derived entity produces no verified background lead
- **THEN** the existing background query rewrite fallback may run
- **AND** failure still returns empty source leads without fabricating sources

### Requirement: Background source leads SHALL be bounded for selected-text answers
The system SHALL bound background source leads so background lookup remains fast and does not inflate the final answer prompt.

#### Scenario: Fast background path limits source leads
- **WHEN** the search intent mode is `background_lead`
- **THEN** the fast background provider path retrieves at most two background source leads

#### Scenario: Academic evidence path limits attached background leads
- **WHEN** the search intent mode is `academic_evidence`
- **THEN** any attached fast background lookup retrieves at most one background source lead

#### Scenario: Answer prompt limits non-academic source leads
- **WHEN** source leads are passed into the final answer prompt
- **THEN** the prompt includes at most two non-academic source leads
- **AND** evidence policy remains unchanged

### Requirement: Academic keyword generation SHALL preserve explicit scholarly intent
The academic keyword workflow SHALL NOT classify an explicitly scholarly or source-backed question as `named_entity_background` merely because the question contains `是什么`, `是谁`, or a similar background phrase.

#### Scenario: Scholarly support request with background phrasing
- **WHEN** the user asks `18世纪的伦敦是什么样的？需要有学术文献支撑`
- **THEN** the academic keyword workflow does not use `named_entity_background`
- **AND** it generates historical or research-oriented retrieval keywords

#### Scenario: Academic query focuses on user subject
- **WHEN** the selected text contains a different date or long book-local sentence
- **AND** the user question contains a clear topic such as `18世纪的伦敦`
- **THEN** retrieval keywords prioritize the user topic
- **AND** they do not use the long selected sentence as the primary academic query
