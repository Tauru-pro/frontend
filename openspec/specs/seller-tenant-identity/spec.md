## Purpose

Manage the `SELLER`'s commercial identity (store/ganadería) in Supabase — self-service registration and editing of business profile data, with tenant isolation enforced via a server-issued `tenant_id` JWT claim — replacing the legacy REST backend for this domain.

## Requirements

### Requirement: Self-service store registration
The system SHALL allow a `SELLER` to register their store's commercial identity (business name, description, country, logo, address, phone, business hours) by submitting the settings form, creating the record on first save without requiring any prior provisioning step.

#### Scenario: First-time registration
- **WHEN** a `SELLER` with no existing store record submits the settings form with a business name
- **THEN** the system creates their store record and subsequent visits to the settings page show the saved data

#### Scenario: Editing an existing store
- **WHEN** a `SELLER` with an existing store record submits the settings form with changes
- **THEN** the system updates the existing record rather than creating a duplicate

### Requirement: Store identity is private to its owner, except for admins
The system SHALL allow a `SELLER` to read and write only their own store record, and SHALL allow `ADMIN` and `SUPER_ADMIN` to read all store records.

#### Scenario: Seller cannot read another seller's store
- **WHEN** a `SELLER` attempts to read a store record belonging to a different user
- **THEN** the system returns no data for that record

#### Scenario: Admin can list all stores
- **WHEN** an `ADMIN` or `SUPER_ADMIN` opens the sellers list
- **THEN** the system returns all registered store records, paginated

### Requirement: Verified tenant identity claim
The system SHALL include a `tenant_id` claim in the session JWT, set server-side from the caller's store record id, and SHALL NOT derive tenant isolation from any client-modifiable field.

#### Scenario: Seller's JWT carries their tenant id
- **WHEN** a `SELLER` with a registered store signs in or refreshes their session
- **THEN** their JWT's `tenant_id` claim equals their store record's id

#### Scenario: Non-seller has no tenant id
- **WHEN** a user with role `CUSTOMER`, `ADMIN`, or `SUPER_ADMIN` signs in
- **THEN** their JWT's `tenant_id` claim is absent or null

### Requirement: Store logo upload persists to the store record
The system SHALL associate an uploaded logo image with the seller's store record so it is visible on subsequent loads of the settings page and in the admin sellers list.

#### Scenario: Logo appears after upload
- **WHEN** a `SELLER` uploads a new logo image
- **THEN** the store record reflects the new logo and it renders on the next page load
