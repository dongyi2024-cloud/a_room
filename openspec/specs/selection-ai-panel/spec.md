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

