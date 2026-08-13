## MODIFIED Requirements

### Requirement: Buyer browses the public product catalog
The system SHALL display to any user (anonymous or authenticated) a paginated list of products with `status = ACTIVE` whose owning seller has `SellerProfile.status = ACTIVE`, filterable by product type (STRAW / SUPPLIES), breed (for STRAW products only), and price range.

#### Scenario: Loading the catalog
- **WHEN** a user navigates to `/catalogo`
- **THEN** the system displays the first page of `ACTIVE` products from verified sellers, ordered by creation date descending, showing cover image, product name, type, price, and stock availability badge

#### Scenario: Filtering by product type
- **WHEN** a user selects a product type filter (STRAW or SUPPLIES)
- **THEN** the system reloads the catalog showing only products of the selected type from verified sellers

#### Scenario: Filtering by breed
- **WHEN** a user selects a breed from the filter list (only shown when type = STRAW)
- **THEN** the system reloads the catalog showing only STRAW products linked to a bull of the selected breed, from verified sellers

#### Scenario: Filtering by price range
- **WHEN** a user enters a minimum and/or maximum price and applies the filter
- **THEN** the system reloads the catalog showing only products within the specified price range, from verified sellers

#### Scenario: Paginating results
- **WHEN** there are more products than the page limit (12)
- **THEN** the system displays pagination controls and loads the correct page when the user navigates

#### Scenario: Empty catalog
- **WHEN** no products match the active filters
- **THEN** the system shows an empty state message and a prompt to clear filters

#### Scenario: Suspended seller's products disappear from the catalog
- **WHEN** a seller's `SellerProfile.status` changes from `ACTIVE` to `SUSPENDED` after they have published `ACTIVE` products
- **THEN** those products no longer appear in `/catalogo`, without requiring any change to the products' own `status` field

### Requirement: Buyer views product detail
The system SHALL display a full product detail page at `/catalogo/:id` showing all relevant product information and allowing the buyer to add the product to the cart, only when the product's `status = ACTIVE` AND its owning seller's `SellerProfile.status = ACTIVE`.

#### Scenario: Viewing a STRAW product detail
- **WHEN** a user navigates to `/catalogo/:id` for a STRAW product from a verified seller
- **THEN** the system displays the product name, cover image, gallery, price, straw type label, linked bull name, minimum order quantity, current stock, description, and an "Add to cart" button

#### Scenario: Viewing a SUPPLIES product detail
- **WHEN** a user navigates to `/catalogo/:id` for a SUPPLIES product from a verified seller
- **THEN** the system displays the product name, cover image, gallery, price, minimum order quantity, current stock, description, and an "Add to cart" button

#### Scenario: Product not found
- **WHEN** a user navigates to `/catalogo/:id` for a non-existent, non-`ACTIVE` product, or a product whose owning seller is not verified
- **THEN** the system displays a "producto no encontrado" message and a link to return to the catalog

#### Scenario: Out of stock product
- **WHEN** a product has `stock_quantity = 0`
- **THEN** the system displays an "Agotado" badge and the "Add to cart" button is disabled

### Requirement: Bull data of active products is readable without a session
The system SHALL let any user, authenticated or not, read the bull linked to an `ACTIVE` product from a verified seller — at minimum its name and breed — so that the catalog and the product detail render the genetic information they promise. Bulls with no `ACTIVE` product from a verified seller SHALL remain private to their seller and to administrators.

#### Scenario: Anonymous catalog listing
- **WHEN** an unauthenticated user loads the catalog
- **THEN** each STRAW card shows the breed of its bull instead of a placeholder dash

#### Scenario: Anonymous product detail
- **WHEN** an unauthenticated user opens the detail of a STRAW product from a verified seller
- **THEN** the linked bull's name is displayed

#### Scenario: Unpublished bull stays private
- **WHEN** an unauthenticated user queries a bull that has no `ACTIVE` product from a verified seller
- **THEN** the system returns no row for it
