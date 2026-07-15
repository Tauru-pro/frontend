## ADDED Requirements

### Requirement: Super admin manages the segmentation survey
The system SHALL allow only a `SUPER_ADMIN` to create, edit, reorder, activate/deactivate, and remove the segmentation survey questions used in provider onboarding, from the backoffice.

#### Scenario: Super admin adds a question
- **WHEN** a `SUPER_ADMIN` creates a survey question with a prompt, input type, and (for choice types) a set of options
- **THEN** the question is saved and becomes available to include in the active survey

#### Scenario: Non-super-admin cannot manage the survey
- **WHEN** a caller whose verified role is not `SUPER_ADMIN` attempts to create or modify a survey question, even bypassing the UI
- **THEN** the system rejects the operation at the server layer

#### Scenario: Reordering questions
- **WHEN** a `SUPER_ADMIN` changes the order of the questions
- **THEN** the onboarding wizard renders the questions in the new order

### Requirement: Survey questions support multiple input types
The system SHALL support at least single-choice, multiple-choice, free-text, and numeric question types, and SHALL allow marking a question as required.

#### Scenario: Choice question exposes its options
- **WHEN** a single-choice or multiple-choice question is presented in the wizard
- **THEN** the user can only submit answers from the configured options

#### Scenario: Required question enforced
- **WHEN** a question is marked required and left unanswered
- **THEN** the wizard prevents advancing past the survey step

### Requirement: Onboarding renders the active survey and stores responses
The system SHALL present only active questions in the onboarding wizard, and SHALL persist each user's answers linked to their account.

#### Scenario: Only active questions appear
- **WHEN** a user reaches the survey step
- **THEN** only questions marked active are shown, in their configured order

#### Scenario: Responses are stored per user
- **WHEN** the user completes onboarding
- **THEN** their answers are stored and associated with their user id for later segmentation

#### Scenario: Responses are readable by admins, private to the user otherwise
- **WHEN** an `ADMIN` or `SUPER_ADMIN` reviews onboarding responses
- **THEN** they can read responses, while a regular user can read only their own
