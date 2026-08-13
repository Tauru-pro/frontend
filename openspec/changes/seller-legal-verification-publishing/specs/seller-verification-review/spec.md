## ADDED Requirements

### Requirement: SUPER_ADMIN/ADMIN reviews a seller's legal documents
The system SHALL provide `SUPER_ADMIN` and `ADMIN` with a list of sellers and their uploaded legal documents (`RUT`, `LEGAL_REP`), and SHALL allow them to approve or reject each document individually with an optional reason (required on rejection).

#### Scenario: Viewing a seller's documents
- **WHEN** a `SUPER_ADMIN` or `ADMIN` opens a seller's detail view in the backoffice sellers list
- **THEN** the system displays each uploaded document, its type, its current status (`PENDING_REVIEW`, `APPROVED`, `REJECTED`), and an approve/reject action for documents in `PENDING_REVIEW`

#### Scenario: Approving a document
- **WHEN** a `SUPER_ADMIN` or `ADMIN` approves a `PENDING_REVIEW` document
- **THEN** the system sets that document's status to `APPROVED`

#### Scenario: Rejecting a document
- **WHEN** a `SUPER_ADMIN` or `ADMIN` rejects a `PENDING_REVIEW` document with a reason
- **THEN** the system sets that document's status to `REJECTED` and the reason becomes visible to the owning `SELLER`

### Requirement: Seller verification status is derived from required document approval
The system SHALL automatically transition a seller's `SellerProfile.status` from `PENDING` to `ACTIVE` when every required document type (`RUT` and `LEGAL_REP`) for that seller is `APPROVED`, and SHALL NOT require a separate manual "approve seller" action.

#### Scenario: Last required document approved
- **WHEN** a `SUPER_ADMIN` or `ADMIN` approves a document and, after this approval, both `RUT` and `LEGAL_REP` documents for that seller are `APPROVED`
- **THEN** the system sets the seller's `SellerProfile.status` to `ACTIVE`

#### Scenario: One of two required documents still pending
- **WHEN** a `SUPER_ADMIN` or `ADMIN` approves one required document but the other required document type has not yet been uploaded or approved
- **THEN** the seller's `SellerProfile.status` remains `PENDING`

### Requirement: Seller sees document rejection feedback and can re-upload
The system SHALL display the rejection reason on any `REJECTED` document in the seller's legal documents screen, and SHALL allow the seller to upload a replacement, which resets that document's status to `PENDING_REVIEW`.

#### Scenario: Viewing a rejected document
- **WHEN** a `SELLER` opens their legal documents screen and has a `REJECTED` document
- **THEN** the system shows the rejection reason provided by the reviewer

#### Scenario: Re-uploading after rejection
- **WHEN** a `SELLER` uploads a new file for a document type that was previously `REJECTED`
- **THEN** the system replaces the document and sets its status back to `PENDING_REVIEW` for another review pass

### Requirement: ADMIN receives a pending-documents count notification in the sidebar
The system SHALL display a numeric badge on the "Vendedores" (or equivalent sellers) sidebar nav item showing the count of documents in `PENDING_REVIEW` status whenever a `SUPER_ADMIN`/`ADMIN` is authenticated in the backoffice, fetched once on backoffice layout initialization, showing `9+` when the count exceeds 9.

#### Scenario: Badge visible with pending documents
- **WHEN** a `SUPER_ADMIN`/`ADMIN` loads any backoffice page and there are documents in `PENDING_REVIEW` status
- **THEN** the sidebar shows a red badge with the pending count on the sellers nav item

#### Scenario: Badge hidden when queue is empty
- **WHEN** a `SUPER_ADMIN`/`ADMIN` loads any backoffice page and there are no documents in `PENDING_REVIEW` status
- **THEN** no badge is shown on the sellers nav item

### Requirement: Only SUPER_ADMIN/ADMIN can change document review status or seller verification status
The system SHALL prevent any role other than `SUPER_ADMIN`/`ADMIN` from transitioning a document between `PENDING_REVIEW`, `APPROVED`, and `REJECTED`, and SHALL prevent any role other than the system's automatic derivation (Requirement: Seller verification status is derived from required document approval) from setting `SellerProfile.status` to `ACTIVE`.

#### Scenario: Seller attempts to self-approve a document
- **WHEN** a `SELLER` attempts to update one of their own documents' status directly
- **THEN** the system denies the operation via RLS

#### Scenario: Seller attempts to self-verify
- **WHEN** a `SELLER` attempts to set their own `SellerProfile.status` to `ACTIVE` directly
- **THEN** the system denies the operation via RLS
