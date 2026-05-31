## ADDED Requirements

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
