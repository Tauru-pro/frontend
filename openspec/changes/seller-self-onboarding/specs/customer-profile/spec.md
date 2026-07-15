## ADDED Requirements

### Requirement: Authenticated customer can view their personal information
The system SHALL provide an authenticated `CUSTOMER` a profile page showing their personal account information (at least name and email), reachable from the account menu.

#### Scenario: Customer opens their profile
- **WHEN** a signed-in `CUSTOMER` opens their profile page
- **THEN** the system displays their personal information

#### Scenario: Unauthenticated access is blocked
- **WHEN** an unauthenticated user navigates to the customer profile route
- **THEN** the system redirects them to sign-in

### Requirement: Customer can edit their personal information
The system SHALL allow a `CUSTOMER` to update their editable personal details and persist the changes to their own profile only.

#### Scenario: Customer updates their details
- **WHEN** a `CUSTOMER` edits their personal details and saves
- **THEN** the system persists the changes and shows the updated values on the next load

#### Scenario: Customer cannot edit another user's profile
- **WHEN** a `CUSTOMER` attempts to modify data belonging to another user
- **THEN** the system rejects the write

### Requirement: Profile exposes the become-a-provider entry point
The system SHALL surface the "Quiero ser proveedor" entry point from the customer profile for users who are not yet sellers.

#### Scenario: Non-seller sees the entry point on their profile
- **WHEN** a `CUSTOMER` views their profile
- **THEN** a visible action to start provider onboarding is present
