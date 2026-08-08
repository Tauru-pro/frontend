## ADDED Requirements

### Requirement: Bull data of active products is readable without a session
The system SHALL let any user, authenticated or not, read the bull linked to an `ACTIVE` product — at minimum its name and breed — so that the catalog and the product detail render the genetic information they promise. Bulls with no `ACTIVE` product SHALL remain private to their seller and to administrators.

#### Scenario: Anonymous catalog listing
- **WHEN** an unauthenticated user loads the catalog
- **THEN** each STRAW card shows the breed of its bull instead of a placeholder dash

#### Scenario: Anonymous product detail
- **WHEN** an unauthenticated user opens the detail of a STRAW product
- **THEN** the linked bull's name is displayed

#### Scenario: Unpublished bull stays private
- **WHEN** an unauthenticated user queries a bull that has no `ACTIVE` product
- **THEN** the system returns no row for it
