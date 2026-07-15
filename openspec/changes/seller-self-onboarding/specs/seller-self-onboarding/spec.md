## ADDED Requirements

### Requirement: Visible entry point to become a provider
The system SHALL present a visible "become a provider" call-to-action to non-seller users in the marketplace (navbar and customer profile), and SHALL route the user into the provider onboarding flow when selected.

#### Scenario: Authenticated customer sees the CTA
- **WHEN** a signed-in `CUSTOMER` browses the marketplace
- **THEN** a "Quiero ser proveedor" option is visible and, when selected, opens the onboarding wizard

#### Scenario: Visitor without an account selects the CTA
- **WHEN** an unauthenticated visitor selects "Quiero ser proveedor"
- **THEN** the system first requires them to create a buyer account (accepting buyer terms) and, once authenticated, continues into the onboarding wizard

#### Scenario: Existing sellers are not offered onboarding
- **WHEN** a user whose role is already `SELLER` views the marketplace
- **THEN** the "become a provider" CTA is not shown and any attempt to open the onboarding flow redirects them to the seller panel

### Requirement: Account is a prerequisite for onboarding
The system SHALL require an authenticated account before collecting any provider onboarding data, and SHALL only allow users with role `CUSTOMER` to start the flow.

#### Scenario: Unauthenticated access is blocked
- **WHEN** an unauthenticated user navigates directly to the onboarding route
- **THEN** the system redirects them to sign-in/sign-up and returns them to the flow after authenticating

### Requirement: Multi-step provider onboarding wizard
The system SHALL guide the user through a multi-step wizard consisting of, in order: (1) basic company data, (2) the segmentation survey defined by the super admin, and (3) acceptance of provider terms and conditions; with visible progress, per-step validation, and the ability to go back without losing entered data.

#### Scenario: Company data step
- **WHEN** the user submits the company step with the required business fields
- **THEN** the data is retained and the wizard advances to the survey step

#### Scenario: Survey step renders the active survey
- **WHEN** the user reaches the survey step
- **THEN** the system renders the currently active segmentation survey and validates required answers before advancing

#### Scenario: Provider terms must be accepted to finish
- **WHEN** the user reaches the final step
- **THEN** the system requires explicit acceptance of the provider terms and conditions before the account can be submitted

#### Scenario: Incomplete step blocks progress
- **WHEN** the user tries to advance with missing required fields or unanswered required survey questions
- **THEN** the system blocks progression and shows validation messages for the offending fields

### Requirement: Secure role promotion on completion
The system SHALL, upon successful submission, persist the company profile, the survey responses, and the provider terms acceptance, and SHALL promote the user's role from `CUSTOMER` to `SELLER` through a privileged server-side operation that a client cannot perform directly.

#### Scenario: Completion promotes the role
- **WHEN** the user submits a complete onboarding (company data + required survey answers + accepted provider terms)
- **THEN** the system creates/updates their `seller_profiles` record, stores their survey responses and terms acceptance, and sets their role to `SELLER`

#### Scenario: Client cannot self-promote
- **WHEN** a `CUSTOMER` attempts to set their own role to `SELLER` directly (bypassing the onboarding server operation)
- **THEN** the system rejects the change at the database layer

#### Scenario: Partial failure does not half-promote
- **WHEN** any part of the submission fails server-side
- **THEN** the role is not changed and the user can retry without a corrupted intermediate state

### Requirement: Session reflects the new role after completion
The system SHALL refresh the user's session after promotion so the new `SELLER` role (and tenant identity) take effect, and SHALL redirect the user to the seller panel.

#### Scenario: New seller lands in the panel
- **WHEN** onboarding completes successfully
- **THEN** the system refreshes the session so the JWT carries `user_role = SELLER`, and redirects the user to the seller panel with access granted
