## ADDED Requirements

### Requirement: An earning is created only on genuine payment approval
The system SHALL create a `seller_earnings` row only as a consequence of a payment genuinely reaching `APPROVED` status, and SHALL NOT create one merely because an order was created, is pending, or is in any non-approved payment state.

#### Scenario: No earning for an order still pending payment
- **WHEN** an order exists with a payment in `CREATED`, `PENDING`, `DECLINED`, `ERROR`, or `EXPIRED` status
- **THEN** the system has created no `seller_earnings` row for that order

#### Scenario: Earning created on approval
- **WHEN** a payment transitions to `APPROVED` for the first time
- **THEN** the system creates one `seller_earnings` row for each distinct seller present in that order's items

### Requirement: One earning per seller per order, computed from that seller's own line items
The system SHALL compute each earning's `gross_amount` as the sum of `order_items.subtotal` for that specific `(order, seller)` pair, never from the order's whole-order `total`.

#### Scenario: Multi-seller order produces separate, correctly-scoped earnings
- **WHEN** a payment is approved for an order containing items from two different sellers
- **THEN** the system creates two `seller_earnings` rows, each with a `gross_amount` equal to only that seller's own item subtotals, and neither row's `gross_amount` includes the other seller's items

### Requirement: Commission is frozen at earning-creation time
The system SHALL resolve the seller's segment's currently-active commission rate at the moment the earning is created and store `commission_rate`, `commission_amount`, and `seller_net_amount` permanently on that row, such that `gross_amount - commission_amount = seller_net_amount`, and SHALL NOT recompute these values if the segment's commission rule later changes.

#### Scenario: Later commission change does not alter a past earning
- **WHEN** a seller's segment's commission rate is 25% at the time an earning is created, and the rate is later changed to 20%
- **THEN** that earning's `commission_rate` remains 25% indefinitely

#### Scenario: Gross, commission, and net are internally consistent
- **WHEN** any `seller_earnings` row is created
- **THEN** `gross_amount - commission_amount` equals `seller_net_amount`

### Requirement: Missing segment or commission rule never blocks payment processing
The system SHALL still create an earning when a seller has no assigned segment or no active commission rule, using `commission_rate = 0`, `commission_amount = 0`, `seller_net_amount = gross_amount`, `status = 'PENDING'`, and `needs_commission_review = true`, and SHALL NOT fail, reject, or delay the payment-approval transaction because of it.

#### Scenario: Payment approval succeeds even for an unassigned seller
- **WHEN** a payment is approved for an order whose seller has `segment_id IS NULL`
- **THEN** the order still transitions to `PAID`, and the system creates a `seller_earnings` row flagged `needs_commission_review = true` rather than raising an error

#### Scenario: Flagged earning does not advance until resolved
- **WHEN** a `seller_earnings` row has `needs_commission_review = true`
- **THEN** it remains in `PENDING` status and is not eligible for settlement until an admin resolves its commission

#### Scenario: Admin resolves a flagged earning
- **WHEN** an admin supplies a commission rate for a `needs_commission_review` earning
- **THEN** the system recomputes `commission_amount`/`seller_net_amount`, clears the flag, and moves the row to `AVAILABLE`

### Requirement: Idempotent under duplicate or retried payment-approval events
The system SHALL create at most one `seller_earnings` row per `(payment_id, seller_id)` pair, regardless of how many times the underlying payment-approval processing runs for the same payment.

#### Scenario: Duplicate webhook delivery does not duplicate earnings
- **WHEN** the same payment-approved event is processed more than once for the same payment
- **THEN** the system still has exactly one `seller_earnings` row per seller for that payment

### Requirement: Earning lifecycle states
The system SHALL track each earning through `PENDING`, `AVAILABLE`, `IN_SETTLEMENT`, `SETTLED`, and `REVERSED`, and SHALL only allow settlement inclusion (`AVAILABLE → IN_SETTLEMENT`) for earnings not flagged `needs_commission_review`.

#### Scenario: Newly-resolved earning is available for settlement
- **WHEN** an earning has a resolved, non-flagged commission
- **THEN** its status is `AVAILABLE` and it is eligible to be included in a settlement

#### Scenario: Earning moves to IN_SETTLEMENT when claimed
- **WHEN** an `AVAILABLE` earning is included in a newly-created settlement
- **THEN** its status becomes `IN_SETTLEMENT`

#### Scenario: Earning becomes SETTLED when its settlement is paid
- **WHEN** the settlement containing an `IN_SETTLEMENT` earning is marked `PAID`
- **THEN** that earning's status becomes `SETTLED`

### Requirement: Reversal preserves history via a compensating entry
The system SHALL NOT delete or edit an earning's original `gross_amount`/`commission_amount`/`seller_net_amount` to reverse it. Reversal SHALL mark the original row `REVERSED` and insert a new row with negated amounts, referencing the original, regardless of whether the original is `AVAILABLE`, `IN_SETTLEMENT`, or `SETTLED`.

#### Scenario: Reversing an available earning
- **WHEN** an admin reverses an `AVAILABLE` earning
- **THEN** the original row's status becomes `REVERSED` and a new negative-amount `AVAILABLE` row is created referencing it

#### Scenario: Reversing an already-settled earning does not alter historical settlement records
- **WHEN** an admin reverses an earning whose status is `SETTLED`
- **THEN** the original earning row and the settlement it belonged to remain unchanged in the historical record, and a new negative-amount `AVAILABLE` row is created that will be included in a future settlement

#### Scenario: Reversal is admin-only and requires a reason
- **WHEN** an admin reverses an earning
- **THEN** the system requires a reason and records the reversal in the financial audit log

### Requirement: Seller can read their own earnings, never anyone else's, and cannot modify any earning
The system SHALL allow a `SELLER` to read their own `seller_earnings` rows and SHALL NOT allow them to create, update, or delete any `seller_earnings` row.

#### Scenario: Seller sees only their own earnings
- **WHEN** a `SELLER` queries `seller_earnings`
- **THEN** the system returns only rows where `seller_id` matches their own seller profile

#### Scenario: Seller cannot modify earning fields
- **WHEN** a `SELLER` attempts to write to `commission_rate`, `commission_amount`, `seller_net_amount`, or `status` on any `seller_earnings` row
- **THEN** the system rejects the write
