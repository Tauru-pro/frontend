## Purpose

This capability defines how any user (anonymous or authenticated) browses the public product catalog and views individual product detail pages. It covers catalog filtering, pagination, empty states, and the product detail view with add-to-cart entry point.

## Requirements

### Requirement: Buyer browses the public product catalog
The system SHALL display to any user (anonymous or authenticated) a paginated list of products with `status = ACTIVE`, filterable by product type (STRAW / SUPPLIES), breed (for STRAW products only), and price range.

#### Scenario: Loading the catalog
- **WHEN** a user navigates to `/catalogo`
- **THEN** the system displays the first page of ACTIVE products ordered by creation date descending, showing cover image, product name, type, price, and stock availability badge

#### Scenario: Filtering by product type
- **WHEN** a user selects a product type filter (STRAW or SUPPLIES)
- **THEN** the system reloads the catalog showing only products of the selected type

#### Scenario: Filtering by breed
- **WHEN** a user selects a breed from the filter list (only shown when type = STRAW)
- **THEN** the system reloads the catalog showing only STRAW products linked to a bull of the selected breed

#### Scenario: Filtering by price range
- **WHEN** a user enters a minimum and/or maximum price and applies the filter
- **THEN** the system reloads the catalog showing only products within the specified price range

#### Scenario: Paginating results
- **WHEN** there are more products than the page limit (12)
- **THEN** the system displays pagination controls and loads the correct page when the user navigates

#### Scenario: Empty catalog
- **WHEN** no products match the active filters
- **THEN** the system shows an empty state message and a prompt to clear filters

### Requirement: Buyer views product detail
The system SHALL display a full product detail page at `/catalogo/:id` showing all relevant product information and allowing the buyer to add the product to the cart.

#### Scenario: Viewing a STRAW product detail
- **WHEN** a user navigates to `/catalogo/:id` for a STRAW product
- **THEN** the system displays the product name, cover image, gallery, price, straw type label, linked bull name, minimum order quantity, current stock, description, and an "Add to cart" button

#### Scenario: Viewing a SUPPLIES product detail
- **WHEN** a user navigates to `/catalogo/:id` for a SUPPLIES product
- **THEN** the system displays the product name, cover image, gallery, price, minimum order quantity, current stock, description, and an "Add to cart" button

#### Scenario: Product not found
- **WHEN** a user navigates to `/catalogo/:id` for a non-existent or non-ACTIVE product
- **THEN** the system displays a "producto no encontrado" message and a link to return to the catalog

#### Scenario: Out of stock product
- **WHEN** a product has `stock_quantity = 0`
- **THEN** the system displays an "Agotado" badge and the "Add to cart" button is disabled
