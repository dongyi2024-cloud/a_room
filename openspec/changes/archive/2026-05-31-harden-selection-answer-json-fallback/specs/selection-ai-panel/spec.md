## ADDED Requirements

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
