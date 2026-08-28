## ADDED Requirements

### Requirement: Only admins create and process settlements
The system SHALL allow only `ADMIN`/`SUPER_ADMIN` to create a settlement, add earnings to it, mark it `PAID`, or cancel it, and SHALL NOT allow a `SELLER` to perform any of these actions.

#### Scenario: Seller cannot create a settlement
- **WHEN** a `SELLER` attempts to create a `settlements` row
- **THEN** the system rejects the write

#### Scenario: Admin creates a settlement from available earnings
- **WHEN** an `ADMIN`/`SUPER_ADMIN` selects a set of a seller's `AVAILABLE` earnings and creates a settlement
- **THEN** the system creates a `settlements` row with `gross_amount`/`commission_amount`/`net_amount` summed from the selected earnings, one `settlement_items` row per included earning, and the earnings' status becomes `IN_SETTLEMENT`

### Requirement: An earning can never be claimed by two settlements
The system SHALL guarantee, even under concurrent settlement-creation requests, that a given `seller_earnings` row is included in at most one non-cancelled settlement at a time.

#### Scenario: Concurrent settlement creation race
- **WHEN** two settlement-creation requests simultaneously attempt to include the same `AVAILABLE` earning
- **THEN** exactly one request succeeds in claiming that earning, and the other either excludes it or fails outright with a conflict, but the earning is never claimed by both

#### Scenario: An already-claimed earning cannot be selected again
- **WHEN** an earning's status is `IN_SETTLEMENT` or `SETTLED`
- **THEN** it does not appear in the list of earnings available for a new settlement

### Requirement: Marking a settlement paid finalizes its earnings
The system SHALL, when an `ADMIN`/`SUPER_ADMIN` marks a settlement `PAID`, atomically set that settlement's status to `PAID`, record `processed_at`, and set every `IN_SETTLEMENT` earning linked to it (via `settlement_items`) to `SETTLED`.

#### Scenario: Paying a settlement settles its earnings
- **WHEN** an admin marks a `PENDING`/`PROCESSING` settlement as `PAID`
- **THEN** every earning included in that settlement becomes `SETTLED`, and the settlement's `processed_at` is recorded

### Requirement: Settlement audit trail
The system SHALL record settlement creation, processing (status transitions), and cancellation in the financial audit log with actor, previous status, new status, and an optional reason/notes.

#### Scenario: Settlement lifecycle is auditable
- **WHEN** a settlement moves from `DRAFT` to `PENDING` to `PAID`, or is `CANCELLED`
- **THEN** each transition is recorded in the financial audit log with the acting admin's identity and timestamp

### Requirement: Settlement detail is fully traceable to underlying earnings
The system SHALL allow retrieval of every `seller_earnings` row (and, through it, the originating order/payment) included in a given settlement via `settlement_items`.

#### Scenario: Auditing a settlement's contents
- **WHEN** anyone with access to a settlement views its detail
- **THEN** the system lists every earning included in it, each traceable back to its originating order and payment

### Requirement: Seller reads their own settlement history and detail, read-only
The system SHALL allow a `SELLER` to view their own settlements (list and detail, including which earnings/orders each settlement covers), and SHALL NOT allow them to modify any settlement or settlement item.

#### Scenario: Seller views settlement history
- **WHEN** a `SELLER` opens their settlements history
- **THEN** the system lists every settlement created for them, most recent first, with status, period, and amounts

#### Scenario: Seller views settlement detail
- **WHEN** a `SELLER` opens one of their own settlements
- **THEN** the system shows every earning/order included in it

#### Scenario: Seller cannot see another seller's settlements
- **WHEN** a `SELLER` attempts to view a settlement belonging to a different seller
- **THEN** the system returns no data
