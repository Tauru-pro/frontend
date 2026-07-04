## ADDED Requirements

### Requirement: Seller manages their own bulls (reproductive sires)
The system SHALL allow a `SELLER` to create, read, update, and delete bulls belonging to their tenant, capturing name, breed, origin (NATIONAL/IMPORTED), registration type (PURO/COMERCIAL), code (SKU), description, and status (DRAFT/ACTIVE/SUSPENDED).

#### Scenario: Creating a bull
- **WHEN** a `SELLER` submits the new-bull form with a name and breed
- **THEN** the system creates the bull under their tenant in DRAFT status and it appears in their bull list

#### Scenario: Editing a bull
- **WHEN** a `SELLER` updates an existing bull's data
- **THEN** the system saves the changes and reflects them in the bull list

#### Scenario: Deleting a bull
- **WHEN** a `SELLER` deletes a bull that has no active products linked to it
- **THEN** the system removes it from their bull list

### Requirement: Bulls are isolated by tenant
The system SHALL restrict bull read/write access to the owning tenant's `SELLER` via the verified `tenant_id` JWT claim, and SHALL allow `ADMIN`/`SUPER_ADMIN` to read all bulls.

#### Scenario: Seller cannot access another tenant's bulls
- **WHEN** a `SELLER` attempts to read or modify a bull belonging to a different tenant
- **THEN** the system denies the operation

### Requirement: Seller attaches media to bulls
The system SHALL allow a `SELLER` to upload up to 3 images and 1 video per bull via Supabase Storage, designating one image as the cover.

#### Scenario: Uploading a bull image
- **WHEN** a `SELLER` uploads an image for a bull
- **THEN** the system stores the file in Supabase Storage and records the reference in `product_media`

#### Scenario: Setting a cover image
- **WHEN** a `SELLER` designates an image as the cover
- **THEN** the system marks it as `is_cover = true` and unmarks any previous cover for that bull

#### Scenario: Exceeding image limit
- **WHEN** a `SELLER` attempts to upload a 4th image for a bull
- **THEN** the system rejects the upload with a limit error
