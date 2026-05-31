## ADDED Requirements

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
