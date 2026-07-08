## ADDED Requirements

### Requirement: Seller manages their own bulls (reproductive sires)
The system SHALL allow a `SELLER` to create, read, update, and delete bulls belonging to their tenant, capturing name, breed, origin (NATIONAL/IMPORTED), registration type (PURO/COMERCIAL), code (SKU), description, and status (DRAFT/ACTIVE/SUSPENDED).

#### Scenario: Creating a bull
- **WHEN** a `SELLER` submits the new-bull form with a name and breed
- **THEN** the system creates the bull under their tenant in DRAFT status and it appears in their bull list

#### Scenario: Editing a bull
- **WHEN** a `SELLER` updates an existing bull's data
- **THEN** the system saves the changes and reflects them in the bull list

#### Scenario: Deleting a bull
- **WHEN** a `SELLER` deletes a bull that has no active products linked to it
- **THEN** the system removes it from their bull list

### Requirement: Bulls are isolated by tenant
The system SHALL restrict bull read/write access to the owning tenant's `SELLER` via the verified `tenant_id` JWT claim, and SHALL allow `ADMIN`/`SUPER_ADMIN` to read all bulls.

#### Scenario: Seller cannot access another tenant's bulls
- **WHEN** a `SELLER` attempts to read or modify a bull belonging to a different tenant
- **THEN** the system denies the operation

### Requirement: Seller attaches media to bulls
The system SHALL allow a `SELLER` to upload up to 3 images, 1 video, and 1 PDF document per bull via Supabase Storage. Images may be designated as cover. The PDF document SHALL be used to attach the genetic test report (prueba genética) for the bull.

#### Scenario: Uploading a bull image
- **WHEN** a `SELLER` uploads an image (JPG, PNG, WEBP, or AVIF) for a bull in the form step 2
- **THEN** the system stores the file in Supabase Storage under the bull's media path and records it in `bull_media` with `media_type = 'image'`

#### Scenario: Setting a cover image
- **WHEN** a `SELLER` designates an image as the cover
- **THEN** the system marks it as `is_cover = true` and unmarks any previous cover for that bull

#### Scenario: Exceeding image limit
- **WHEN** a `SELLER` attempts to upload a 4th image for a bull
- **THEN** the system rejects the upload with a limit error

#### Scenario: Uploading a bull video
- **WHEN** a `SELLER` uploads a video (MP4 or WebM) for a bull
- **THEN** the system stores the file in Supabase Storage and records it in `bull_media` with `media_type = 'video'`

#### Scenario: Uploading a genetic test PDF
- **WHEN** a `SELLER` uploads a PDF file in the "Prueba Genética" section of the bull form step 2
- **THEN** the system stores the PDF in Supabase Storage and records it in `bull_media` with `media_type = 'document'`

#### Scenario: Replacing the genetic test PDF
- **WHEN** a `SELLER` edits a bull that already has a PDF document and uploads a new PDF
- **THEN** the system deletes the previous document from Storage and records the new one, so that at most one PDF document exists per bull

#### Scenario: Viewing an existing genetic test PDF
- **WHEN** a `SELLER` opens the edit form for a bull that has a PDF document
- **THEN** the system displays the document name and a link to open it, along with a button to delete it

#### Scenario: Invalid file type for document section
- **WHEN** a `SELLER` attempts to drop or select a non-PDF file in the document section
- **THEN** the system ignores the file and does not add it to the pending document

#### Scenario: Document uploaded alongside images and video
- **WHEN** a `SELLER` submits the form step 2 with pending images, a pending video, and a pending PDF document
- **THEN** the system uploads all files sequentially, updating the progress bar for each, and navigates to the bull list on success
