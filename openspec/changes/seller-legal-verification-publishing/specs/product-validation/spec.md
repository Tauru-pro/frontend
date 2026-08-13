## REMOVED Requirements

### Requirement: SUPER_ADMIN reviews products pending validation
**Reason**: Publishing is now gated by seller-level legal verification (see `seller-verification-review`) instead of a per-product admin review. A verified seller's products publish directly on submission; a non-verified seller's products cannot be published regardless of any admin action on the product itself, so the `PENDING_VALIDATION` queue is no longer populated by any new submission.
**Migration**: Products already in `PENDING_VALIDATION` at deploy time remain visible in the existing `/admin/products` review screen so a `SUPER_ADMIN` can clear the backlog one last time (approve/reject/request changes as before). The screen and its actions are not deleted, only no longer reachable from any new seller submission.

### Requirement: SELLER can see the validation status and feedback on their products
**Reason**: This feedback loop (rejection reason / change-request comment tied to a per-product admin review) only applied to products that entered `PENDING_VALIDATION`. New products no longer enter that state, so seller-facing feedback about why a product isn't public now comes from their verification status (see `seller-verification-review`) rather than per-product review comments.
**Migration**: Sellers with pre-existing `REJECTED`/`CHANGES_REQUESTED` products from before this change continue to see those legacy statuses and may still resubmit into `PENDING_VALIDATION` for one-time admin clearance; no data migration is performed on existing rows.

## MODIFIED Requirements

### Requirement: Only SUPER_ADMIN can change product validation status
The system SHALL allow a `SELLER` to directly transition their own product's status to `ACTIVE` only when their `SellerProfile.status = ACTIVE`, and SHALL continue to allow `SUPER_ADMIN`/`ADMIN` to transition any product's status for moderation purposes (e.g. suspending a published listing) regardless of the owning seller's verification status. The system SHALL reject a `SELLER`'s attempt to set `status = ACTIVE` while their own `SellerProfile.status` is `PENDING` or `SUSPENDED`, independent of the product's own completeness, both at the RLS layer and in the UI.

#### Scenario: SELLER attempts to self-approve while unverified
- **WHEN** a `SELLER` whose `SellerProfile.status` is not `ACTIVE` attempts to update a product's status to `ACTIVE` directly
- **THEN** the system denies the operation via RLS

#### Scenario: Verified seller publishes directly
- **WHEN** a `SELLER` whose `SellerProfile.status = ACTIVE` submits a complete product for publishing
- **THEN** the system sets the product's status to `ACTIVE` immediately, with no `SUPER_ADMIN` action required

#### Scenario: SUPER_ADMIN moderates regardless of seller verification
- **WHEN** a `SUPER_ADMIN` sets an `ACTIVE` product's status to `SUSPENDED`
- **THEN** the system applies the change regardless of the owning seller's verification status

## ADDED Requirements

### Requirement: Non-verified seller can create and edit products but cannot publish them
The system SHALL allow a `SELLER` whose `SellerProfile.status` is `PENDING` or `SUSPENDED` to create, edit, and delete their own products in `DRAFT` status, and SHALL prevent those products from reaching `ACTIVE` status through any seller-initiated action.

#### Scenario: Non-verified seller creates a product
- **WHEN** a `SELLER` whose `SellerProfile.status` is not `ACTIVE` submits the new-product form
- **THEN** the system creates the product in `DRAFT` status and it appears in their product list

#### Scenario: Non-verified seller attempts to publish
- **WHEN** a `SELLER` whose `SellerProfile.status` is `PENDING` or `SUSPENDED` attempts to publish a product
- **THEN** the system keeps the product in `DRAFT` and does not transition it to `ACTIVE`

### Requirement: SELLER sees why a product cannot be published
The system SHALL display a persistent banner or disabled-state explanation on the product create/edit/list screens telling a non-verified `SELLER` that publishing is blocked pending legal-document verification, with a link to the legal documents screen.

#### Scenario: Unverified seller views the product form
- **WHEN** a `SELLER` whose `SellerProfile.status` is not `ACTIVE` opens a product create or edit form
- **THEN** the system shows a banner explaining that publishing requires completed legal verification, links to `seller/legal-documents`, and disables the "Publicar" action

#### Scenario: Verified seller views the product form
- **WHEN** a `SELLER` whose `SellerProfile.status = ACTIVE` opens a product create or edit form
- **THEN** the system shows no verification banner and the "Publicar" action is enabled
