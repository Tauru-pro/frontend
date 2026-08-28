## ADDED Requirements

### Requirement: Server-side dashboard aggregation, scoped to the caller
The system SHALL provide a single server-side function that computes all seller dashboard metrics for a given date range, resolving the seller identity from the authenticated caller's session, and SHALL NOT allow the caller to request another seller's metrics by supplying a different seller id.

#### Scenario: Dashboard metrics reflect only the caller's own data
- **WHEN** a `SELLER` requests their dashboard summary
- **THEN** the returned figures (gross sales, orders, doses, commission, net, pending settlement, settled) are computed only from that seller's own orders/items/earnings

#### Scenario: Supplying another seller's id has no effect
- **WHEN** a request includes any seller identifier other than the caller's own
- **THEN** the system ignores it and still returns only the caller's own metrics

### Requirement: Selectable reporting period
The system SHALL allow a seller to view dashboard metrics for: today, last 7 days, last 30 days, this month, last month, this year, or a custom date range.

#### Scenario: Switching the period recomputes the summary
- **WHEN** a seller selects a different period option
- **THEN** the dashboard summary figures update to reflect only that period's data

#### Scenario: Custom range validation
- **WHEN** a seller selects a custom range with an end date before the start date
- **THEN** the system rejects or corrects the range rather than returning a nonsensical result

### Requirement: Sales summary
The system SHALL show, for the selected period: gross sales, number of orders, doses sold, and average order value — computed only from orders/items that produced a real `seller_earnings` row (i.e., payment genuinely approved).

#### Scenario: Cancelled or unpaid orders are excluded
- **WHEN** an order was cancelled, never paid, or otherwise never reached payment approval
- **THEN** its items are excluded from doses sold and gross sales for that period

#### Scenario: Average order value is derived, not stored separately
- **WHEN** the sales summary is computed
- **THEN** average order value equals gross sales divided by number of orders for that period

### Requirement: Financial cards
The system SHALL show, for the selected period: total collected, platform commission, net sales, amount pending settlement, and amount already settled, each computed from `seller_earnings`/`settlements` state rather than a simplified subtraction of order totals.

#### Scenario: Pending settlement reflects earning status, not a raw subtraction
- **WHEN** the financial cards are computed
- **THEN** "pending settlement" equals the sum of `seller_net_amount` for earnings in `AVAILABLE` or `IN_SETTLEMENT` status, not "total collected minus settled"

#### Scenario: Settled reflects only PAID settlements
- **WHEN** the financial cards are computed
- **THEN** "settled" equals the sum of `seller_net_amount` for earnings with status `SETTLED`, corresponding only to settlements marked `PAID`

### Requirement: Segment and commission are shown, informationally
The system SHALL display the seller's current segment name and currently-effective commission percentage on the dashboard, and SHALL NOT provide any control that lets the seller change either value.

#### Scenario: Segment and commission are visible
- **WHEN** a seller with an assigned segment and active commission rule views their dashboard
- **THEN** the segment name and commission percentage are both displayed

#### Scenario: No edit affordance exists
- **WHEN** a seller views their dashboard
- **THEN** no UI control allows them to change their segment or commission rate

### Requirement: Recent orders
The system SHALL show the seller's most recent orders on the dashboard, reusing the existing seller-scoped order data (`seller-order-fulfillment`) rather than a separate, duplicated read path.

#### Scenario: Recent orders list appears
- **WHEN** a seller with at least one order opens their dashboard
- **THEN** the dashboard shows their most recent orders with status and date

### Requirement: Settlement history access from the dashboard
The system SHALL let a seller navigate from the dashboard to their full settlement history and to any individual settlement's detail.

#### Scenario: Navigating to settlement history
- **WHEN** a seller selects the settlements section from the dashboard
- **THEN** the system shows their settlement history as described in `seller-settlements`

### Requirement: Dashboard updates without a manual refresh on payment approval
The system SHALL update the seller's dashboard figures when a payment relevant to them is approved, without requiring the seller to manually reload the page, and SHALL NOT produce duplicate visible updates for a single underlying approval event even if the approval was processed via a retried/duplicate webhook delivery.

#### Scenario: Real-time update on approval
- **WHEN** a payment for one of the seller's orders is approved while they have the dashboard open
- **THEN** the relevant figures update without a manual page reload

#### Scenario: Duplicate webhook delivery does not cause a duplicate visible update
- **WHEN** the same payment-approval event is delivered more than once
- **THEN** the dashboard reflects the single underlying change exactly once, consistent with `seller-earnings`' idempotency guarantee
