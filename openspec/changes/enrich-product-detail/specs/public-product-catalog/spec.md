## ADDED Requirements

### Requirement: The detail page loads in a single request
The system SHALL serve everything the detail page needs — the product, its bull, the media of both, and the bull's other approved straws with their own media — in one request, so that no part of the page arrives late and switching variants costs nothing.

#### Scenario: Opening a product detail
- **WHEN** a buyer opens a product detail page
- **THEN** the client issues one request for its data

#### Scenario: Product not published
- **WHEN** the requested product is not `ACTIVE`
- **THEN** the request returns no row and the page shows its not-found state

### Requirement: The detail page shows the bull's video when one exists
When the bull linked to a STRAW product has a video, the detail page SHALL play it with the browser's native player alongside the image gallery. When there is no video, no player and no empty placeholder SHALL be rendered.

#### Scenario: Bull with a video
- **WHEN** a buyer opens the detail of a straw whose bull has a video
- **THEN** the page shows a playable video with standard controls

#### Scenario: Bull without a video
- **WHEN** the bull has no video
- **THEN** the page shows no video section at all

#### Scenario: Supply product
- **WHEN** the product is a supply, which has no bull
- **THEN** no video section is shown

### Requirement: The detail page previews the bull's genetic test document
When the bull has a PDF document, the detail page SHALL embed it so its first page is visible, and SHALL offer an action to open it full screen or download it. The action SHALL work even where the browser refuses to embed PDFs.

#### Scenario: Bull with a genetic test
- **WHEN** a buyer opens the detail of a straw whose bull has a PDF document
- **THEN** the page shows the embedded document and an action to open it in a new tab

#### Scenario: Browser cannot embed PDFs
- **WHEN** the browser does not render the embedded PDF
- **THEN** the action to open or download the document remains available and labelled

#### Scenario: Bull without a genetic test
- **WHEN** the bull has no PDF document
- **THEN** the page shows no document section

### Requirement: The detail page lets the buyer switch straw type
The detail page of a STRAW product SHALL list the approved straws of the same bull as selectable variants and SHALL indicate which one is being viewed. Choosing another variant SHALL update the page in place, without reloading it and without further requests, and SHALL keep the address bar pointing at the variant on screen so the link stays shareable.

#### Scenario: Bull with several approved straws
- **WHEN** a buyer opens the detail of a straw whose bull offers three approved types
- **THEN** the page offers the three as variants, marking the current one

#### Scenario: Switching variant
- **WHEN** the buyer picks a different straw type
- **THEN** the price, stock and minimum order quantity become that variant's without reloading the page and without issuing any request

#### Scenario: Address after switching
- **WHEN** the buyer picks a different straw type and then reloads or shares the address
- **THEN** the address points at the variant that was on screen

#### Scenario: Bull with a single approved straw
- **WHEN** the bull offers only one approved straw
- **THEN** the type is shown as a label rather than as a selector

#### Scenario: Unapproved siblings are excluded
- **WHEN** the bull has straws that are not `ACTIVE`
- **THEN** they are not offered as variants, even to a signed-in seller who owns them

### Requirement: Prices are shown as formatted Colombian pesos
The system SHALL present every price across the buying journey — catalog cards, product detail, cart and checkout — as Colombian pesos with thousands separators and no decimals, using one shared formatter.

#### Scenario: Price on the detail page
- **WHEN** a product costs 30000
- **THEN** the detail page shows `$30.000`, not `$30000.00 USD`

#### Scenario: Consistency across the journey
- **WHEN** the buyer moves from a catalog card to the detail page, and from there to the cart and checkout
- **THEN** the same product's price reads identically at every step

## MODIFIED Requirements

### Requirement: Buyer views product detail
The system SHALL display a full product detail page at `/catalogo/:id` showing all relevant product information and allowing the buyer to add the product to the cart, including the media the seller attached to the linked bull.

#### Scenario: Viewing a STRAW product detail
- **WHEN** a user navigates to `/catalogo/:id` for a STRAW product
- **THEN** the system displays the product name, cover image, gallery, formatted price, the bull's approved straw types as variants, linked bull name, minimum order quantity, current stock, description, the bull's video and genetic test document when they exist, and an "Add to cart" button

#### Scenario: Viewing a SUPPLIES product detail
- **WHEN** a user navigates to `/catalogo/:id` for a SUPPLIES product
- **THEN** the system displays the product name, cover image, gallery, formatted price, minimum order quantity, current stock, description, and an "Add to cart" button

#### Scenario: Product not found
- **WHEN** a user navigates to `/catalogo/:id` for a non-existent or non-ACTIVE product
- **THEN** the system displays a "producto no encontrado" message and a link to return to the catalog

#### Scenario: Out of stock product
- **WHEN** a product has `stock_quantity = 0`
- **THEN** the system displays an "Agotado" badge and the "Add to cart" button is disabled

#### Scenario: Adding the viewed variant to the cart
- **WHEN** the buyer sets a quantity and adds to the cart
- **THEN** the variant currently on screen is added, honouring its minimum order quantity
