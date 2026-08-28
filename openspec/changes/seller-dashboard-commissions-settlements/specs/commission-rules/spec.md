## ADDED Requirements

### Requirement: Commission rate stored as a configurable percentage per segment
The system SHALL store each segment's commission as a `seller_segment_commission_rules` row with `commission_rate numeric(5,2)` representing a whole percentage (e.g. `25.00` means 25%), and SHALL NOT hardcode a segment's commission rate in application code (Angular or Edge Functions).

#### Scenario: Initial rules seeded correctly
- **WHEN** the commission-rules migration runs
- **THEN** `seller_segment_commission_rules` contains active rules of `25.00` for `DISTRIBUTOR`, `25.00` for `LABORATORY`, and `30.00` for `LIVESTOCK_COMPANY`, each with `effective_from` at seed time and no `effective_until`

#### Scenario: Commission math always divides by 100
- **WHEN** the system computes `commission_amount` from a `gross_amount` and a `commission_rate`
- **THEN** it computes `round(gross_amount * commission_rate / 100)`, consistent with the stored whole-percentage convention

### Requirement: At most one active rule covers any instant for a given segment
The system SHALL prevent two `active` commission rules for the same segment from having overlapping `[effective_from, effective_until)` ranges.

#### Scenario: Overlapping rule rejected
- **WHEN** an admin attempts to create a new active rule for a segment whose effective range overlaps an existing active rule for the same segment
- **THEN** the system rejects the creation

#### Scenario: Back-to-back rules are allowed
- **WHEN** an admin creates a new rule for a segment with `effective_from` equal to the previous rule's `effective_until`
- **THEN** the system accepts the creation, since the ranges do not overlap

### Requirement: Changing a segment's commission preserves history
The system SHALL allow an admin to change a segment's commission rate effective from a future (or immediate) date without altering any previously-recorded rule, by closing the current rule's `effective_until` and inserting a new rule starting where the old one ends.

#### Scenario: Future-dated commission change
- **WHEN** a `SUPER_ADMIN` changes `DISTRIBUTOR`'s commission from 25% to 20% effective a future date
- **THEN** the system keeps the existing 25% rule with its `effective_until` set to that future date, and creates a new 20% rule starting at that date, both remaining queryable afterward

#### Scenario: Historical rate is still resolvable after a change
- **WHEN** the commission rate for a segment changes
- **THEN** a query for "what rate applied to segment X on date D" (any date before the change) still returns the rate that was active on that date

### Requirement: Current-rate resolution
The system SHALL provide a function that, given a segment and a timestamp, returns the single commission rate active at that timestamp, or no result if none is configured.

#### Scenario: Resolves the currently active rate
- **WHEN** the current-rate function is called for a segment with an active rule covering the current time
- **THEN** it returns that rule's `commission_rate`

#### Scenario: No active rule configured
- **WHEN** the current-rate function is called for a segment with no rule covering the given timestamp
- **THEN** it returns no result, and callers (see `seller-earnings`) treat this as "commission review required," never as an error that blocks processing

### Requirement: Admin commission configuration
The system SHALL allow an `ADMIN`/`SUPER_ADMIN` to view, create, and schedule commission rules per segment, and SHALL NOT allow a `SELLER` to view or modify any commission rule beyond their own currently-applicable rate.

#### Scenario: Admin views all rules for a segment
- **WHEN** a `SUPER_ADMIN` opens a segment's commission configuration
- **THEN** the system lists every rule ever configured for that segment, past and future, in chronological order

#### Scenario: Seller cannot write commission rules
- **WHEN** a `SELLER` attempts to create, update, or delete a `seller_segment_commission_rules` row
- **THEN** the system rejects the write

### Requirement: Seller reads their own current commission rate, informationally only
The system SHALL allow a `SELLER` to see their segment name and the commission rate currently in effect for it, and SHALL NOT allow them to modify it.

#### Scenario: Seller views their current commission
- **WHEN** a `SELLER` with an assigned segment and an active commission rule views their dashboard
- **THEN** the system shows their segment name and the currently-effective commission percentage

#### Scenario: Seller has no resolvable rate yet
- **WHEN** a `SELLER` has no assigned segment, or their segment has no active commission rule
- **THEN** the system shows an informational "pending assignment" state rather than a fabricated percentage
