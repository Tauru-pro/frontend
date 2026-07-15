## ADDED Requirements

### Requirement: Buyer terms acceptance at registration
The system SHALL require an unauthenticated visitor to explicitly accept the current buyer terms and conditions before their account is created on the public sign-up page, and SHALL record that acceptance (audience and version) associated with the new account.

#### Scenario: Registration requires accepting buyer terms
- **WHEN** a visitor submits the sign-up form without accepting the buyer terms and conditions
- **THEN** the system blocks account creation and prompts them to accept the terms

#### Scenario: Acceptance is recorded
- **WHEN** a visitor accepts the buyer terms and completes registration
- **THEN** the system creates the account and stores a record of the accepted buyer terms version for that user

#### Scenario: Terms are viewable before accepting
- **WHEN** a visitor is asked to accept the buyer terms
- **THEN** the system provides access to the terms content before acceptance
