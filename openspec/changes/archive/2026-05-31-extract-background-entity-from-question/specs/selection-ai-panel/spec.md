## ADDED Requirements

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
