## ADDED Requirements

### Requirement: Fast background lead lookup SHALL use a short timeout
Fast background lead lookup SHALL use a short default timeout suitable for the selected-text AI fast path.

#### Scenario: Background lookup default timeout
- **WHEN** fast background lead lookup runs without an explicit timeout override
- **THEN** it uses a default timeout of 1500ms

#### Scenario: Background lookup result count
- **WHEN** fast background lead lookup returns results
- **THEN** the result count remains bounded to a small number suitable for answer prompt inclusion
