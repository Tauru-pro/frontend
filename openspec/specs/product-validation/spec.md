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

### Requirement: SUPER_ADMIN receives a pending-count notification in the sidebar
The system SHALL display a numeric badge on the "Productos" sidebar nav item showing the count of products in `PENDING_VALIDATION` status whenever a `SUPER_ADMIN` is authenticated in the backoffice. The badge SHALL be fetched once on backoffice layout initialization and SHALL show `9+` when the count exceeds 9.

#### Scenario: Badge visible with pending products
- **WHEN** a `SUPER_ADMIN` loads any backoffice page and there are products in `PENDING_VALIDATION` status
- **THEN** the sidebar shows a red badge with the pending count on the "Productos" nav item

#### Scenario: Badge hidden when queue is empty
- **WHEN** a `SUPER_ADMIN` loads any backoffice page and there are no products in `PENDING_VALIDATION` status
- **THEN** no badge is shown on the "Productos" nav item

#### Scenario: Validation queue accessible from sidebar
- **WHEN** a `SUPER_ADMIN` clicks the "Productos" nav item in the sidebar
- **THEN** the system navigates to `/admin/products` showing the pending validation queue

### Requirement: Only SUPER_ADMIN can change product validation status
The system SHALL prevent any role other than SUPER_ADMIN from transitioning products between PENDING_VALIDATION, ACTIVE, REJECTED, and CHANGES_REQUESTED statuses.

#### Scenario: SELLER attempts to self-approve
- **WHEN** a `SELLER` attempts to update a product's status to ACTIVE directly
- **THEN** the system denies the operation via RLS
