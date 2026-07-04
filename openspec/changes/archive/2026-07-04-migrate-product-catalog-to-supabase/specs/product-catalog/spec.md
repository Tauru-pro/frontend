## ADDED Requirements

### Requirement: Seller creates and manages straw products (pajillas)
The system SHALL allow a `SELLER` to create products of type STRAW linked to one of their bulls, capturing straw type (SEXADO_MALE / SEXADO_FEMALE / CONVENTIONAL), price, minimum order quantity, stock quantity, SKU code, and description.

#### Scenario: Creating a straw product
- **WHEN** a `SELLER` submits the product form with type STRAW, an associated bull, price, and straw type
- **THEN** the system creates the product in DRAFT status under their tenant

#### Scenario: Creating without selecting a bull
- **WHEN** a `SELLER` submits a STRAW product form without selecting a bull
- **THEN** the system rejects the creation and displays a validation error

### Requirement: Seller creates and manages supply products (insumos)
The system SHALL allow a `SELLER` to create products of type SUPPLIES capturing name, description, price, stock quantity, and SKU code — without requiring a bull association.

#### Scenario: Creating a supply product
- **WHEN** a `SELLER` submits the product form with type SUPPLIES, a name, and price
- **THEN** the system creates the product in DRAFT status under their tenant

### Requirement: Products are isolated by tenant
The system SHALL restrict product read/write access to the owning tenant's `SELLER` via the verified `tenant_id` JWT claim, and SHALL allow `ADMIN`/`SUPER_ADMIN` to read all products.

#### Scenario: Seller cannot access another tenant's products
- **WHEN** a `SELLER` attempts to read or modify a product belonging to a different tenant
- **THEN** the system denies the operation

### Requirement: Seller attaches media to products
The system SHALL allow a `SELLER` to upload up to 3 images per product via Supabase Storage, designating one as the cover.

#### Scenario: Uploading a product image
- **WHEN** a `SELLER` uploads an image for a product
- **THEN** the system stores the file in Supabase Storage and records the reference in `product_media`

#### Scenario: Setting a cover image
- **WHEN** a `SELLER` designates an image as the cover
- **THEN** the system marks it as `is_cover = true` and unmarks any previous cover for that product

### Requirement: Seller submits a product for validation
The system SHALL allow a `SELLER` to transition a DRAFT product to PENDING_VALIDATION, making it visible to SUPER_ADMIN for review.

#### Scenario: Submitting a product
- **WHEN** a `SELLER` clicks "Enviar para revisión" on a DRAFT product
- **THEN** the product status changes to PENDING_VALIDATION and it appears in the admin validation queue

### Requirement: Active products are publicly visible in the catalog
The system SHALL make products with status ACTIVE readable by any authenticated or unauthenticated user through the public catalog query, filtered by product type and breed (for STRAW).

#### Scenario: Browsing the public catalog
- **WHEN** any user queries the product catalog
- **THEN** the system returns only ACTIVE products ordered by creation date descending
