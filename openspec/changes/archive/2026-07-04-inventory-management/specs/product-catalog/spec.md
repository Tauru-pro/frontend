## MODIFIED Requirements

### Requirement: Seller creates and manages straw products (pajillas)
The system SHALL allow a `SELLER` to create products of type STRAW linked to one of their bulls, capturing straw type (SEXADO_MALE / SEXADO_FEMALE / CONVENTIONAL), price, minimum order quantity, and description. The `stock_quantity` field SHALL NOT be editable by the `SELLER` in the product form; it is maintained automatically by the inventory system.

#### Scenario: Creating a straw product
- **WHEN** a `SELLER` submits the product form with type STRAW, an associated bull, price, and straw type
- **THEN** the system creates the product in DRAFT status with `stock_quantity = 0` under their tenant

#### Scenario: Creating without selecting a bull
- **WHEN** a `SELLER` submits a STRAW product form without selecting a bull
- **THEN** the system rejects the creation and displays a validation error

#### Scenario: Stock quantity is read-only on the product form
- **WHEN** a `SELLER` views the product creation or edit form
- **THEN** the system does not display or accept a `stock_quantity` input field; stock is managed exclusively through inventory movements

### Requirement: Seller creates and manages supply products (insumos)
The system SHALL allow a `SELLER` to create products of type SUPPLIES capturing name, description, price, and SKU code — without requiring a bull association. The `stock_quantity` field SHALL NOT be editable by the `SELLER` in the product form; it is maintained automatically by the inventory system.

#### Scenario: Creating a supply product
- **WHEN** a `SELLER` submits the product form with type SUPPLIES, a name, and price
- **THEN** the system creates the product in DRAFT status with `stock_quantity = 0` under their tenant

#### Scenario: Stock quantity is read-only on the product form
- **WHEN** a `SELLER` views the product creation or edit form for a SUPPLIES product
- **THEN** the system does not display or accept a `stock_quantity` input field
