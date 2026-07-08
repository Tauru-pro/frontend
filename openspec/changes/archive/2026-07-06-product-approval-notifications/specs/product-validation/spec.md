## MODIFIED Requirements

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
