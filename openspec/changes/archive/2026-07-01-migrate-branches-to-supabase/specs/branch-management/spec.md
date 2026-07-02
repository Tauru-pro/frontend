## ADDED Requirements

### Requirement: Seller manages their own branches
The system SHALL allow a `SELLER` to create, read, update, and delete branches belonging to their own tenant, capturing name, address, GPS coordinates, city, business hours, phone, and status.

#### Scenario: Creating a branch
- **WHEN** a `SELLER` submits the "new branch" form with a name, city, and address
- **THEN** the system creates the branch under their tenant and it appears in their branch list

#### Scenario: Editing a branch
- **WHEN** a `SELLER` updates an existing branch's data
- **THEN** the system saves the changes and reflects them in the branch list

#### Scenario: Deleting a branch
- **WHEN** a `SELLER` deletes a branch
- **THEN** the system removes it and it no longer appears in their branch list

### Requirement: Branches are isolated by tenant
The system SHALL restrict branch read/write access to the owning tenant's `SELLER`, using a verified tenant identity claim, and SHALL allow `ADMIN`/`SUPER_ADMIN` to read all branches.

#### Scenario: Seller cannot access another tenant's branches
- **WHEN** a `SELLER` attempts to read, update, or delete a branch belonging to a different tenant
- **THEN** the system denies the operation

#### Scenario: Admin can read all branches
- **WHEN** an `ADMIN` or `SUPER_ADMIN` queries branches
- **THEN** the system returns branches across all tenants

### Requirement: Exactly one main branch per tenant when branches exist
The system SHALL ensure a tenant has at most one branch marked as main, automatically unmarking any previous main branch when a new one is designated, and SHALL automatically mark a tenant's first branch as main.

#### Scenario: First branch becomes main automatically
- **WHEN** a `SELLER` with no existing branches creates their first branch
- **THEN** the system marks it as the main branch

#### Scenario: Designating a new main branch
- **WHEN** a `SELLER` designates a different branch as main
- **THEN** the system marks the new branch as main and unmarks the previous one, leaving exactly one main branch

### Requirement: Duplicate branch names within a tenant are rejected
The system SHALL prevent a tenant from having two branches with the same name.

#### Scenario: Creating a branch with a name already used by the same tenant
- **WHEN** a `SELLER` submits a branch name that already exists among their own branches
- **THEN** the system rejects the creation and the form shows a duplicate-name error
