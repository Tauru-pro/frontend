## ADDED Requirements

### Requirement: SUPER_ADMIN reviews products pending validation
The system SHALL provide a `SUPER_ADMIN` with a list of all products in PENDING_VALIDATION status across all tenants, and SHALL allow them to approve, reject, or request changes on each one.

#### Scenario: Viewing the validation queue
- **WHEN** a `SUPER_ADMIN` navigates to `/admin/products`
- **THEN** the system displays all products with status PENDING_VALIDATION from all tenants, paginated

#### Scenario: Approving a product
- **WHEN** a `SUPER_ADMIN` approves a PENDING_VALIDATION product
- **THEN** the product status changes to ACTIVE and becomes visible in the public catalog

#### Scenario: Rejecting a product
- **WHEN** a `SUPER_ADMIN` rejects a PENDING_VALIDATION product with a reason
- **THEN** the product status changes to REJECTED and the SELLER can see the rejection reason

#### Scenario: Requesting changes
- **WHEN** a `SUPER_ADMIN` requests changes on a PENDING_VALIDATION product with a comment
- **THEN** the product status changes to CHANGES_REQUESTED and the SELLER can see the comment and resubmit after editing

### Requirement: SELLER can see the validation status and feedback on their products
The system SHALL display the current validation status on each product in the SELLER's list, including rejection reasons and change request comments when applicable.

#### Scenario: Viewing a rejected product
- **WHEN** a `SELLER` views a REJECTED product in their list
- **THEN** the system shows the rejection reason provided by the SUPER_ADMIN

#### Scenario: Resubmitting after changes requested
- **WHEN** a `SELLER` edits a CHANGES_REQUESTED product and submits it again
- **THEN** the product status changes back to PENDING_VALIDATION for re-review

### Requirement: Only SUPER_ADMIN can change product validation status
The system SHALL prevent any role other than SUPER_ADMIN from transitioning products between PENDING_VALIDATION, ACTIVE, REJECTED, and CHANGES_REQUESTED statuses.

#### Scenario: SELLER attempts to self-approve
- **WHEN** a `SELLER` attempts to update a product's status to ACTIVE directly
- **THEN** the system denies the operation via RLS
