## ADDED Requirements

### Requirement: Seller views inventory items per branch
The system SHALL display to a `SELLER` a list of all `inventory_items` records belonging to their tenant, showing current stock, branch name, product name, and a low-stock indicator when `current_stock ≤ min_stock_quantity`.

#### Scenario: Viewing inventory list
- **WHEN** a `SELLER` navigates to `/seller/inventory`
- **THEN** the system displays all inventory items for their tenant, each showing product name, branch name, current stock, and minimum stock threshold

#### Scenario: Low-stock indicator
- **WHEN** an inventory item has `current_stock ≤ min_stock_quantity`
- **THEN** the system highlights the item with a visual warning badge

#### Scenario: No inventory items
- **WHEN** a `SELLER` has no inventory items yet
- **THEN** the system shows an empty state with a prompt to register the first stock movement

### Requirement: Seller registers inventory movements
The system SHALL allow a `SELLER` to record a stock movement of type ENTRY, EXIT, ADJUSTMENT, SALE, or CANCELLATION for a given product+branch combination, specifying a positive quantity and optional notes.

#### Scenario: Registering an entry movement
- **WHEN** a `SELLER` submits a movement form with type ENTRY, a valid product, a valid branch, and a positive quantity
- **THEN** the system inserts a record into `inventory_movements` and the trigger updates `inventory_items.current_stock` by adding the quantity

#### Scenario: Registering an exit movement
- **WHEN** a `SELLER` submits a movement form with type EXIT and a quantity less than or equal to `current_stock`
- **THEN** the system inserts the movement and the trigger decrements `current_stock` accordingly

#### Scenario: Exit exceeding available stock
- **WHEN** a `SELLER` attempts to register an EXIT with a quantity greater than `current_stock`
- **THEN** the system rejects the operation and displays a validation error indicating insufficient stock

#### Scenario: Implicit item creation on first movement
- **WHEN** a `SELLER` registers a movement for a product+branch combination with no existing inventory item
- **THEN** the system creates the `inventory_items` record automatically with the resulting balance as the initial stock

### Requirement: Seller views movement history for an inventory item
The system SHALL display the full chronological history of `inventory_movements` for a selected inventory item, ordered from most recent to oldest, with movement type, quantity, resulting balance, notes, and creation timestamp.

#### Scenario: Viewing movement history
- **WHEN** a `SELLER` selects an inventory item from the list
- **THEN** the system displays all movements for that product+branch pair belonging to their tenant

#### Scenario: Tenant isolation in history
- **WHEN** a `SELLER` queries movement history
- **THEN** the system returns only movements belonging to their tenant, never another tenant's data

### Requirement: Seller configures minimum stock threshold
The system SHALL allow a `SELLER` to set or update the `min_stock_quantity` for any `inventory_items` record belonging to their tenant.

#### Scenario: Setting minimum stock threshold
- **WHEN** a `SELLER` updates the minimum stock quantity for an inventory item
- **THEN** the system persists the value and the low-stock indicator immediately reflects the change on next render

### Requirement: SUPER_ADMIN views global inventory overview
The system SHALL allow a `SUPER_ADMIN` to view inventory items across all tenants, filterable by tenant and by branch, showing current stock and product information.

#### Scenario: Viewing global inventory
- **WHEN** a `SUPER_ADMIN` navigates to `/admin/inventory`
- **THEN** the system displays inventory items from all tenants with tenant name, product name, branch name, and current stock

#### Scenario: Filtering by tenant
- **WHEN** a `SUPER_ADMIN` applies a tenant filter
- **THEN** the system displays only inventory items belonging to the selected tenant

### Requirement: Inventory data is isolated by tenant via RLS
The system SHALL enforce that `inventory_items` and `inventory_movements` records are readable and writable only by the owning tenant's `SELLER`, with `SUPER_ADMIN` able to read all records.

#### Scenario: Seller cannot read another tenant's inventory
- **WHEN** a `SELLER` queries inventory data
- **THEN** the system returns only records where `tenant_id` matches the verified JWT claim

#### Scenario: SUPER_ADMIN reads all inventory
- **WHEN** a `SUPER_ADMIN` queries inventory data
- **THEN** the system returns records from all tenants

### Requirement: Products stock_quantity is synchronized by trigger
The system SHALL automatically maintain `products.stock_quantity` as the sum of `inventory_items.current_stock` for all branches of a given product whenever an inventory movement is recorded.

#### Scenario: Stock synchronized after entry
- **WHEN** an inventory movement increases `current_stock` for a product in any branch
- **THEN** `products.stock_quantity` is updated to reflect the new total across all branches

#### Scenario: Stock synchronized after exit
- **WHEN** an inventory movement decreases `current_stock` for a product in any branch
- **THEN** `products.stock_quantity` is updated to reflect the new total, which may reach zero
