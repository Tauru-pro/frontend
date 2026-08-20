## ADDED Requirements

### Requirement: Seller order list, scoped and filterable
The system SHALL allow an authenticated seller to list orders containing at least one of their own products, showing per-order summaries computed only from that seller's own line items, filterable by fulfillment status, payment status, date range, order number, and buyer name, with filtering and pagination performed server-side.

#### Scenario: Seller sees only orders containing their products
- **WHEN** an authenticated seller requests their order list
- **THEN** the system returns only orders that have at least one `order_items` row with that seller's `seller_id`

#### Scenario: Seller in a multi-seller order sees only their own subtotal
- **WHEN** an order contains items from the requesting seller and at least one other seller
- **THEN** the order summary returned to the requesting seller shows only their own item count and their own items' subtotal, never the order's full total

#### Scenario: Filtering by fulfillment status
- **WHEN** a seller filters the order list by fulfillment status `PROCESSING`
- **THEN** the system returns only orders where that seller's fulfillment record has `status = 'PROCESSING'`

#### Scenario: Server-side pagination
- **WHEN** a seller requests page 2 of their order list with a page size of 20
- **THEN** the system returns at most 20 rows computed and filtered in the database, not a client-side slice of a larger downloaded set

### Requirement: Seller order detail, scoped to their own items
The system SHALL allow a seller to view the full detail of an order they have items in, including only their own `order_items` rows, non-financial order-level context (order id, date, buyer name/email/phone, pickup point), a read-only payment status summary excluding monetary amount and any raw provider data, and their own fulfillment status and history.

#### Scenario: Seller views their portion of a shared order
- **WHEN** a seller requests detail for an order that also contains another seller's items
- **THEN** the system returns only the requesting seller's `order_items` rows, order-level non-financial context, and no data belonging to the other seller

#### Scenario: Seller requests an order they have no items in
- **WHEN** a seller requests detail for an order containing no items of theirs
- **THEN** the system returns no data for that order

#### Scenario: Payment summary excludes sensitive and monetary detail
- **WHEN** a seller views the payment section of an order's detail
- **THEN** the system shows payment status, payment method, provider reference, provider transaction id, and approval date, and does not include the payment amount, the raw provider response, or any integration secret

#### Scenario: Buyer's personal address is not shown
- **WHEN** a seller views an order's detail
- **THEN** the system shows the pickup point (name and address) but not the buyer's personal shipping address

### Requirement: Per-seller fulfillment record created only when the order is paid
The system SHALL create one fulfillment record per distinct seller present in an order's items, with initial status `RECEIVED`, exactly when the order's payment is approved — never for an order that has not been paid.

#### Scenario: Fulfillment records appear on payment approval
- **WHEN** an order's payment transitions to `APPROVED`
- **THEN** the system creates one `order_seller_fulfillments` row per distinct seller in that order's items, each with `status = 'RECEIVED'`

#### Scenario: No fulfillment record for an unpaid order
- **WHEN** an order is still `PENDING_PAYMENT` or `PAYMENT_PROCESSING`
- **THEN** no `order_seller_fulfillments` row exists for that order, and it does not appear in any seller's order list as an actionable new order

#### Scenario: Duplicate payment-approval webhook does not duplicate fulfillment records
- **WHEN** the same payment-approval event is processed more than once (webhook retry/duplicate)
- **THEN** at most one `order_seller_fulfillments` row per seller is created for that order

### Requirement: Seller fulfillment state machine
The system SHALL allow a seller to transition their own fulfillment record through `RECEIVED → PROCESSING → SHIPPED → COMPLETED`, or to `CANCELLED` from `RECEIVED` or `PROCESSING` with a required reason, and SHALL reject any other transition.

#### Scenario: Valid forward transition
- **WHEN** a seller transitions their fulfillment record from `RECEIVED` to `PROCESSING`
- **THEN** the system applies the change and records it

#### Scenario: Skipping a step is rejected
- **WHEN** a seller attempts to transition a fulfillment record directly from `RECEIVED` to `SHIPPED`
- **THEN** the system rejects the transition

#### Scenario: Cancellation requires a reason
- **WHEN** a seller attempts to cancel a fulfillment record without providing a reason
- **THEN** the system rejects the request

#### Scenario: Cancellation is not allowed after shipping
- **WHEN** a seller attempts to cancel a fulfillment record whose status is `SHIPPED` or `COMPLETED`
- **THEN** the system rejects the transition

#### Scenario: A seller cannot mark an order as paid
- **WHEN** a seller attempts to set their fulfillment record to any status while the underlying order's payment has not been approved
- **THEN** the system rejects the transition, since a fulfillment record only exists once payment is approved (see fulfillment-record-creation requirement)

### Requirement: Fulfillment transitions are atomic and conflict-safe
The system SHALL apply a fulfillment status transition only when the record's current status matches the expected source status for that transition, and SHALL report a conflict rather than silently overwriting a concurrent change.

#### Scenario: Concurrent transition attempts
- **WHEN** two requests attempt to transition the same fulfillment record from `PROCESSING` to `SHIPPED` at nearly the same time
- **THEN** exactly one succeeds and the other receives a conflict response reflecting the record's actual current status

### Requirement: Fulfillment changes are never made via direct client writes
The system SHALL reject any attempt to insert, update, or delete an `order_seller_fulfillments` row directly from the client, and SHALL only apply fulfillment changes through a server-side operation that performs authorization, transition validation, and audit logging together.

#### Scenario: Direct client update is rejected
- **WHEN** a seller's browser attempts to update `order_seller_fulfillments` directly (bypassing the server-side transition operation)
- **THEN** the database rejects the write regardless of any RLS read access the seller has to that row

### Requirement: Fulfillment audit trail
The system SHALL record every fulfillment status change, including the prior status, the new status, who made the change (seller, system, or admin), and any reason given.

#### Scenario: Seller-driven change is attributed
- **WHEN** a seller transitions a fulfillment record from `PROCESSING` to `SHIPPED`
- **THEN** the system records a history entry with `from_status = 'PROCESSING'`, `to_status = 'SHIPPED'`, the seller as actor, and no reason required

#### Scenario: Cancellation reason is recorded
- **WHEN** a seller cancels a fulfillment record with reason "Producto agotado"
- **THEN** the system records that reason in the history entry for the transition to `CANCELLED`

### Requirement: Seller order and fulfillment RLS isolation
The system SHALL enforce, at the database level, that a seller can never read another seller's order items, fulfillment records, or order/payment financial detail, independent of any frontend filtering.

#### Scenario: Seller cannot query another seller's order items
- **WHEN** a seller queries `order_items` directly
- **THEN** only rows with that seller's own `seller_id` are returned, regardless of `order_id`

#### Scenario: Seller cannot query another seller's fulfillment record
- **WHEN** a seller queries `order_seller_fulfillments` directly
- **THEN** only rows with that seller's own `seller_id` are returned

#### Scenario: Seller has no direct read access to raw payment or order-total data
- **WHEN** a seller queries the `orders` or `payments` tables directly (not through the seller-order detail operation)
- **THEN** the query returns no rows, since seller access to order/payment context is only available through the seller-scoped detail operation

### Requirement: Realtime updates for sellers
The system SHALL notify a seller's order view in real time when a new fulfillment record is created for them or when one of their existing fulfillment records changes status, without requiring a page refresh.

#### Scenario: New paid order appears live
- **WHEN** a buyer's payment for an order containing this seller's products is approved while the seller has the order list open
- **THEN** the new order appears in the seller's list without a manual refresh

#### Scenario: Status change reflected live in another session
- **WHEN** a seller updates a fulfillment record's status in one browser tab
- **THEN** a second open session viewing the same order reflects the updated status without a manual refresh
