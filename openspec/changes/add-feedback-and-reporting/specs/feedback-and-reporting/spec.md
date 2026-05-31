## ADDED Requirements

### Requirement: Users can submit structured feedback and reports
The system SHALL let authenticated users submit structured feedback or reports for supported targets.

#### Scenario: Submit AI answer feedback
- **WHEN** a logged-in user submits feedback for an AI answer
- **THEN** the system creates a feedback record bound to that user and AI answer context

#### Scenario: Submit community card report
- **WHEN** a logged-in user reports a community reflection card
- **THEN** the system creates a feedback record bound to that user and reflection-card target

#### Scenario: Submit system issue feedback
- **WHEN** a logged-in user submits feedback for a system issue
- **THEN** the system creates a feedback record with route or surface context

#### Scenario: Unauthenticated submission is rejected
- **WHEN** an unauthenticated client attempts to submit feedback or a report
- **THEN** the system rejects the request and creates no feedback record

### Requirement: Feedback records store target and review metadata
The system SHALL persist feedback records with reporter identity, target information, feedback type, optional detail content, status, and timestamps.

#### Scenario: Feedback record contains required fields
- **WHEN** feedback is accepted
- **THEN** the stored record includes `user_id`, `target_type`, target id or target context, `feedback_type`, `status`, `created_at`, and `updated_at`

#### Scenario: Optional detail is stored
- **WHEN** the user provides additional detail text
- **THEN** the stored record includes the normalized detail content

#### Scenario: Database review is possible
- **WHEN** an operator reviews feedback in Supabase or the database
- **THEN** the records are queryable with target type, feedback type, status, reporter id, and creation time

### Requirement: Supported feedback types are constrained
The system SHALL constrain feedback submissions to supported feedback categories.

#### Scenario: AI answer error category
- **WHEN** a user selects “AI 回答错误”
- **THEN** the system stores the feedback type as an AI-answer-error category

#### Scenario: Citation inaccurate category
- **WHEN** a user selects “引用来源不准确”
- **THEN** the system stores the feedback type as a citation-inaccurate category

#### Scenario: Inappropriate or uncomfortable content category
- **WHEN** a user reports content as inappropriate, offensive, or uncomfortable
- **THEN** the system stores the corresponding content-safety feedback category

#### Scenario: Bug or other category
- **WHEN** a user selects “功能故障” or “其他建议”
- **THEN** the system stores the corresponding bug or other category

#### Scenario: Unsupported category is rejected
- **WHEN** a client submits an unsupported feedback type
- **THEN** the system rejects the request and creates no feedback record

### Requirement: Feedback target validation is enforced
The system MUST validate supported target shapes before storing feedback.

#### Scenario: Reflection card target is verified
- **WHEN** a user reports a reflection card
- **THEN** the server verifies that the target reflection card exists before inserting the report

#### Scenario: AI answer feedback carries reading context
- **WHEN** a user reports an AI answer that is not persisted as a database row
- **THEN** the submission includes enough safe context to identify the answer surface, such as book id, chapter order, paragraph order, question or turn key, and answer excerpt

#### Scenario: Invalid target is rejected
- **WHEN** a submission is missing required target information
- **THEN** the system rejects the request and creates no feedback record

### Requirement: Repeated community reports can mark content for review
The system SHALL mark repeatedly reported community reflection cards as pending review.

#### Scenario: Report count increments
- **WHEN** a community reflection card report is accepted
- **THEN** the system increments or recalculates the report count for that card

#### Scenario: Review threshold reached
- **WHEN** a community reflection card reaches the configured repeated-report threshold
- **THEN** the card enters a pending-review moderation state

#### Scenario: Report does not automatically delete content
- **WHEN** a card enters pending review
- **THEN** the system does not automatically delete the card solely because the threshold was reached

### Requirement: Feedback and reports preserve privacy boundaries
The system MUST NOT expose private reading content, hidden AI dialogue history, or other users' private data through feedback records.

#### Scenario: AI answer feedback stores safe excerpts only
- **WHEN** AI answer feedback is submitted
- **THEN** the system stores only bounded excerpts or metadata needed for review rather than full hidden dialogue history

#### Scenario: Cross-user private context is not revealed
- **WHEN** a user submits or views their own feedback records
- **THEN** the system does not reveal another user's private book, note, or AI context

### Requirement: Feedback UI provides safe interaction states
The system SHALL provide clear feedback/report interaction states on desktop and mobile.

#### Scenario: User opens feedback form
- **WHEN** the user activates a feedback or report action
- **THEN** the system shows a form with target label, feedback type selection, optional detail field, submit action, and cancel action

#### Scenario: Submission succeeds
- **WHEN** feedback is submitted successfully
- **THEN** the UI shows a clear success message

#### Scenario: Submission fails
- **WHEN** feedback cannot be submitted
- **THEN** the UI shows a clear failure message and preserves the user's current surface

#### Scenario: Desktop and mobile are usable
- **WHEN** the feedback form appears on desktop or mobile
- **THEN** controls remain readable, reachable, and do not block unrelated reading or community browsing
