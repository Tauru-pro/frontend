## ADDED Requirements

### Requirement: Segment catalog
The system SHALL maintain a `seller_segments` catalog (`code`, `name`, `description`, `active`) as the only source of valid seller segments, seeded with `DISTRIBUTOR`, `LABORATORY`, and `LIVESTOCK_COMPANY`, and SHALL NOT store a seller's segment as free text anywhere.

#### Scenario: Seeded segments exist after migration
- **WHEN** the segment migration runs
- **THEN** `seller_segments` contains exactly one active row each for `DISTRIBUTOR`, `LABORATORY`, and `LIVESTOCK_COMPANY`

#### Scenario: Segment code is authoritative
- **WHEN** any part of the system needs to know a seller's segment
- **THEN** it reads `seller_profiles.segment_id` (a foreign key into `seller_segments`), never a text field

### Requirement: Segments are deactivated, never deleted
The system SHALL NOT permit physical deletion of a `seller_segments` row that is or has ever been referenced by a `seller_profiles.segment_id` or a `seller_segment_commission_rules.segment_id`, and SHALL instead allow an admin to set `active = false`.

#### Scenario: Admin disables a segment in use
- **WHEN** a `SUPER_ADMIN` sets `active = false` on a segment currently assigned to one or more sellers
- **THEN** those sellers keep their existing `segment_id` assignment and their existing commission rules remain valid, but the segment no longer appears as an option for new assignments

#### Scenario: Deleting an in-use segment is rejected
- **WHEN** an attempt is made to delete a `seller_segments` row referenced by any `seller_profiles` or `seller_segment_commission_rules` row
- **THEN** the system rejects the deletion

### Requirement: Admin segment management
The system SHALL allow an `ADMIN`/`SUPER_ADMIN` to view all segments, create new segments, activate/deactivate them, edit name/description, and view the list of sellers currently assigned to a segment.

#### Scenario: Admin creates a new segment
- **WHEN** a `SUPER_ADMIN` submits a new segment with a unique `code`, `name`, and `description`
- **THEN** the system creates the segment as `active` and it becomes available for seller assignment and commission-rule configuration

#### Scenario: Admin views sellers in a segment
- **WHEN** a `SUPER_ADMIN` opens a segment's detail view
- **THEN** the system lists every seller whose `segment_id` currently references that segment

### Requirement: Segment assignment is an admin action, not a per-order lookup
The system SHALL let an `ADMIN`/`SUPER_ADMIN` assign or change a seller's `segment_id` directly on `seller_profiles`, and SHALL NOT allow a `SELLER` to set or change their own `segment_id`.

#### Scenario: Admin assigns a segment during seller verification
- **WHEN** a `SUPER_ADMIN` reviews a seller's registration (including their onboarding survey answers as context) and selects a segment
- **THEN** the system sets `seller_profiles.segment_id` to the chosen segment, and that value is used for every subsequent commission calculation without re-reading the survey

#### Scenario: Seller cannot self-assign a segment
- **WHEN** a `SELLER` attempts to write to their own `seller_profiles.segment_id`
- **THEN** the system rejects the write

#### Scenario: Admin reassigns a seller's segment
- **WHEN** a `SUPER_ADMIN` changes an already-assigned seller's `segment_id` from one segment to another
- **THEN** the system updates `seller_profiles.segment_id`, records the change in the financial audit log with the previous and new segment, and does not alter any existing `seller_earnings` row

### Requirement: A seller can only be verified once assigned a segment
The system SHALL prevent a `seller_profiles` row from transitioning `status` from `PENDING` to `ACTIVE` while `segment_id IS NULL`.

#### Scenario: Verification blocked without a segment
- **WHEN** an `ADMIN`/`SUPER_ADMIN` attempts to set a seller's `status` to `ACTIVE` while `segment_id` is still null
- **THEN** the system rejects the status change

#### Scenario: Verification succeeds once a segment is assigned
- **WHEN** an `ADMIN`/`SUPER_ADMIN` assigns a segment and then sets the seller's `status` to `ACTIVE`
- **THEN** the system accepts the status change

### Requirement: Seller reads their own current segment
The system SHALL allow a `SELLER` to read their own `segment_id`/segment name, and SHALL NOT allow them to modify it.

#### Scenario: Seller views their segment
- **WHEN** a `SELLER` opens their dashboard or settings
- **THEN** the system shows their currently assigned segment name (or an "unassigned" state if `segment_id` is null)
