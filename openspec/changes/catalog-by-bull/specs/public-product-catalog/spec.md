## ADDED Requirements

### Requirement: The catalog separates genetics from supplies
The catalog SHALL present two sections the buyer switches between: one listing genetics grouped by bull, and one listing supply products individually. Each section SHALL paginate its own results independently.

#### Scenario: Default section
- **WHEN** a buyer opens the catalog
- **THEN** the genetics section is shown, listing bulls

#### Scenario: Switching to supplies
- **WHEN** the buyer switches to the supplies section
- **THEN** the system lists supply products individually, as it did before this change, with its own pagination

#### Scenario: Filters follow the section
- **WHEN** the buyer is in the supplies section
- **THEN** the breed filter is not offered, because supplies have no bull

### Requirement: Genetics are listed one card per bull
In the genetics section the system SHALL render one card per bull rather than one per straw, showing the bull's cover image, the seller's business name, the bull's name and breed, its approved straw types as selectable variants, and the price of the selected variant. Only bulls with at least one `ACTIVE` straw SHALL be listed.

#### Scenario: Bull with several straw types
- **WHEN** a bull has three approved straw types
- **THEN** the catalog shows it as a single card offering the three types as variants, not as three cards

#### Scenario: Bull with one straw type
- **WHEN** a bull has a single approved straw
- **THEN** the card shows that type as a label rather than as a selector

#### Scenario: Bull with no approved straw
- **WHEN** a bull's straws are all unapproved, suspended or out of the catalog
- **THEN** the bull is not listed

#### Scenario: Initial variant
- **WHEN** a bull card is first rendered
- **THEN** the cheapest approved variant is selected and its price displayed

### Requirement: Pagination counts bulls
In the genetics section the system SHALL paginate over bulls and SHALL report the number of bulls found, not the number of straws.

#### Scenario: Result count
- **WHEN** the genetics section finishes loading
- **THEN** the header reports how many bulls match the active filters

#### Scenario: Page navigation
- **WHEN** there are more bulls than the page size
- **THEN** pagination controls appear and each page loads a distinct set of bulls

### Requirement: Price filter matches a bull by any of its variants
The price filter SHALL include a bull when at least one of its approved straws falls within the requested range. The breed filter SHALL include a bull when its breed matches.

#### Scenario: Bull with one variant in range
- **WHEN** the buyer filters from 20.000 to 32.000 and a bull has straws at 30.000 and 45.000
- **THEN** the bull is listed, because one of its variants falls in the range

#### Scenario: Bull with no variant in range
- **WHEN** the buyer filters from 20.000 to 25.000 and a bull's cheapest straw costs 30.000
- **THEN** the bull is not listed

#### Scenario: Filtering by breed
- **WHEN** the buyer selects a breed
- **THEN** only bulls of that breed are listed

#### Scenario: No matches
- **WHEN** no bull matches the active filters
- **THEN** the section shows its empty state with a prompt to clear the filters

### Requirement: The bull card is shared with the home page
The catalog's genetics card and the home page's featured card SHALL be the same component, so both surfaces stay visually identical and behave the same when selecting a variant or adding to the cart.

#### Scenario: Adding from the catalog
- **WHEN** the buyer adds a variant to the cart from a catalog card
- **THEN** it behaves exactly as it does from the home page, honouring the minimum order quantity

#### Scenario: Opening the detail
- **WHEN** the buyer follows a catalog card to the product detail
- **THEN** the detail page for the selected variant opens

## MODIFIED Requirements

### Requirement: Buyer browses the public product catalog
The system SHALL display to any user (anonymous or authenticated) a paginated catalog of published items, filterable by breed and price range. Genetics SHALL be listed grouped by bull; supplies SHALL be listed as individual products. Only content backed by `status = ACTIVE` products SHALL appear.

#### Scenario: Loading the catalog
- **WHEN** a user navigates to `/catalogo`
- **THEN** the system displays the first page of bulls with approved straws, most recently published first, each showing cover image, seller, bull name, breed and the price of its cheapest variant

#### Scenario: Browsing supplies
- **WHEN** a user switches to the supplies section
- **THEN** the system displays the first page of ACTIVE supply products showing cover image, product name, type, price and stock availability badge

#### Scenario: Filtering by breed
- **WHEN** a user selects a breed from the filter list (only shown in the genetics section)
- **THEN** the system reloads the catalog showing only bulls of the selected breed

#### Scenario: Filtering by price range
- **WHEN** a user enters a minimum and/or maximum price and applies the filter
- **THEN** the system reloads the catalog showing only items with at least one variant within the specified price range

#### Scenario: Paginating results
- **WHEN** there are more results than the page limit (12)
- **THEN** the system displays pagination controls and loads the correct page when the user navigates

#### Scenario: Empty catalog
- **WHEN** no item matches the active filters
- **THEN** the system shows an empty state message and a prompt to clear filters
