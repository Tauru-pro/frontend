## Purpose

Persist buyer orders and their line items with server-computed, price-snapshotted totals; track order status through a forward-only state machine from `PENDING_PAYMENT` to a terminal state; expire stale unpaid orders; audit every status transition; and give buyers a live-updating view of their own order history and detail, restricted to their own orders via RLS.

## Requirements

### Requirement: Order and order-item persistence with price snapshotting
The system SHALL persist a created order as an `orders` row plus one `order_items` row per cart line, computed and validated entirely server-side (Edge Function), never trusting a client-submitted price. Each `order_items` row SHALL snapshot `product_name` and `unit_price` at order-creation time, independent of later changes to the product's current price.

#### Scenario: Order total ignores client-submitted price
- **WHEN** a buyer's checkout request includes a `unitPrice` field on a cart item that differs from the product's current `price` in the database
- **THEN** the system computes the order total using the database `price`, not the submitted value

#### Scenario: Historical order preserves the price at purchase time
- **WHEN** a product's price changes after an order containing that product was created
- **THEN** the existing order's `order_items.unit_price` and `product_name` remain unchanged and continue to display the original values

#### Scenario: Unavailable product blocks order creation
- **WHEN** a checkout request includes a product that is not `ACTIVE` or whose `stock_quantity` is less than the requested quantity
- **THEN** the system rejects the entire checkout request without creating an order or reserving stock for any line item

### Requirement: Order status state machine
The system SHALL track order status through the states `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `PAID`, `PROCESSING`, `SHIPPED`, `COMPLETED`, `PAYMENT_FAILED`, `CANCELLED`, `EXPIRED`, and SHALL only allow forward transitions defined in the state machine — never automatically reverting a `PAID` order to an earlier state.

#### Scenario: Order created in PENDING_PAYMENT
- **WHEN** a checkout request succeeds
- **THEN** the created order has `status = 'PENDING_PAYMENT'`

#### Scenario: Payment success advances the order to PAID
- **WHEN** the associated payment reaches `APPROVED`
- **THEN** the order transitions to `PAID` and `orders.paid_at` is set to the current time

#### Scenario: Payment failure does not delete the order
- **WHEN** the associated payment reaches `DECLINED` or `ERROR`
- **THEN** the order transitions to `PAYMENT_FAILED` and remains queryable by the buyer, with the option to retry payment

#### Scenario: A PAID order cannot be reverted by a later event
- **WHEN** an event arrives that would transition an order already in `PAID` (or any later state) back to `PENDING_PAYMENT` or `PAYMENT_PROCESSING`
- **THEN** the system rejects the transition and the order status is unchanged

### Requirement: Order expiration
The system SHALL expire orders that remain in `PENDING_PAYMENT` or `PAYMENT_PROCESSING` past their `expires_at` timestamp, and SHALL never expire an order whose payment has already reached `APPROVED`.

#### Scenario: Expiring a stale unpaid order
- **WHEN** a scheduled process finds an order with `status = 'PENDING_PAYMENT'` or `status = 'PAYMENT_PROCESSING'` and `expires_at` in the past
- **THEN** the system sets `status = 'EXPIRED'` and restores any reserved stock for its order items

#### Scenario: An approved payment prevents expiration
- **WHEN** the expiration process evaluates an order whose payment has already reached `APPROVED` (even if a race caused `expires_at` to have passed)
- **THEN** the system does not expire the order

### Requirement: Order status audit trail
The system SHALL record every order status transition in an `order_status_history` table, including the source of the transition (e.g. buyer action, Wompi webhook, scheduled expiration).

#### Scenario: Webhook-driven transition is recorded
- **WHEN** a validated Wompi webhook causes an order to transition from `PAYMENT_PROCESSING` to `PAID`
- **THEN** the system inserts an `order_status_history` row with `from_status = 'PAYMENT_PROCESSING'`, `to_status = 'PAID'`, and `source = 'WOMPI_WEBHOOK'`

### Requirement: Buyer order history dashboard
The system SHALL allow an authenticated buyer to view a list of their own orders and the detail of a single order (products, subtotal, discounts, taxes, total, order status, payment status, payment method), restricted to orders they own via RLS, and SHALL reflect status changes live without requiring a manual page refresh.

#### Scenario: Buyer views their order list
- **WHEN** an authenticated buyer navigates to "Mis compras"
- **THEN** the system displays every order belonging to that buyer's `user_id`, most recent first, with order number, date, status, and total

#### Scenario: Buyer cannot view another buyer's order
- **WHEN** an authenticated buyer requests the detail of an order belonging to a different `user_id`
- **THEN** the system returns no data for that order (RLS denies the row)

#### Scenario: Order status updates live
- **WHEN** a buyer is viewing an order detail page and the order's status changes from `PAYMENT_PROCESSING` to `PAID` on the backend
- **THEN** the displayed status updates without the buyer reloading the page
