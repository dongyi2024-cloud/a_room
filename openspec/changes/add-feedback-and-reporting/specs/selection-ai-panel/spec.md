## ADDED Requirements

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
