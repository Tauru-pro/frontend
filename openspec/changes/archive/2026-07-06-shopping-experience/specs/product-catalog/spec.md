## MODIFIED Requirements

### Requirement: Active products are publicly visible in the catalog
The system SHALL make products with status ACTIVE readable by any authenticated or unauthenticated user through the public catalog query (`ProductService.getPublicCatalog()`), filtered by product type, breed (for STRAW products via the linked bull), and price range. Results SHALL be returned paginated, ordered by creation date descending.

#### Scenario: Browsing the public catalog
- **WHEN** any user queries the product catalog
- **THEN** the system returns only ACTIVE products ordered by creation date descending

#### Scenario: Filtering by product type in public catalog
- **WHEN** any user queries the catalog with a `productType` filter
- **THEN** the system returns only ACTIVE products of the specified type

#### Scenario: Filtering by breed in public catalog
- **WHEN** any user queries the catalog with a `breedId` filter
- **THEN** the system returns only ACTIVE STRAW products whose linked bull belongs to the specified breed

#### Scenario: Anonymous read access
- **WHEN** an unauthenticated user queries the product catalog
- **THEN** the system returns ACTIVE products without requiring authentication (Supabase anon key is sufficient)
