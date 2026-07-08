## MODIFIED Requirements

### Requirement: Seller attaches media to bulls
The system SHALL allow a `SELLER` to upload up to 3 images, 1 video, and 1 PDF document per bull via Supabase Storage. Images may be designated as cover. The PDF document SHALL be used to attach the genetic test report (prueba genética) for the bull.

#### Scenario: Uploading a bull image
- **WHEN** a `SELLER` uploads an image (JPG, PNG, WEBP, or AVIF) for a bull in the form step 2
- **THEN** the system stores the file in Supabase Storage under the bull's media path and records it in `bull_media` with `media_type = 'image'`

#### Scenario: Setting a cover image
- **WHEN** a `SELLER` designates an image as the cover
- **THEN** the system marks it as `is_cover = true` and unmarks any previous cover for that bull

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
