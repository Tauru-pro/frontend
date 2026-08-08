## ADDED Requirements

### Requirement: A seller can feature one bull at a time
The system SHALL let a seller mark one of their bulls as featured, and SHALL prevent the same seller from having two featured bulls simultaneously. Marking a new bull as featured SHALL unmark the previously featured one in a single atomic operation.

#### Scenario: Featuring the first bull
- **WHEN** a seller with no featured bull marks an eligible bull as featured
- **THEN** that bull becomes the seller's featured bull

#### Scenario: Featuring a second bull
- **WHEN** a seller who already features bull A marks bull B as featured
- **THEN** bull B becomes featured and bull A stops being featured, with no intermediate state in which both are featured

#### Scenario: Unfeaturing
- **WHEN** a seller unmarks their featured bull
- **THEN** the seller has no featured bull and the marketplace stops showing it

#### Scenario: Sellers are independent
- **WHEN** two different sellers each feature one of their own bulls
- **THEN** both featured bulls coexist; the limit is per seller, not marketplace-wide

### Requirement: Only admin-approved bulls can be featured
A bull SHALL only be featurable when at least one of its straws has been approved by the administrator — that is, has status `ACTIVE`. The system SHALL enforce this in the database, not only in the interface, and SHALL reject any attempt to feature a bull that does not meet the condition.

#### Scenario: Bull with an approved straw
- **WHEN** a seller features a bull that has at least one `ACTIVE` straw
- **THEN** the operation succeeds

#### Scenario: Bull awaiting validation
- **WHEN** a seller attempts to feature a bull whose straws are all in `DRAFT`, `PENDING_VALIDATION`, `REJECTED` or `CHANGES_REQUESTED`
- **THEN** the system rejects the operation and the bull is not featured

#### Scenario: Approval revoked after featuring
- **WHEN** the administrator suspends or rejects the last `ACTIVE` straw of a featured bull
- **THEN** the bull stops appearing in the featured section of the marketplace

### Requirement: The seller product list exposes the featured toggle
The bull rows of the seller's product list SHALL offer an action to feature or unfeature that bull, showing which one is currently featured. The action SHALL be disabled, with a visible reason, while the bull has no approved straw.

#### Scenario: Eligible bull
- **WHEN** the seller opens the product list and a bull has an approved straw
- **THEN** the row offers an enabled action to feature it

#### Scenario: Ineligible bull
- **WHEN** a bull has no approved straw
- **THEN** its featuring action is disabled and states that the bull must be approved first

#### Scenario: Currently featured bull
- **WHEN** a bull is the seller's featured one
- **THEN** its row is visibly marked as featured and the action offers to remove the mark

#### Scenario: Supplies are not featurable
- **WHEN** the list shows a supply row rather than a bull row
- **THEN** no featuring action is offered, because the marketplace section is for semen only

### Requirement: The marketplace home shows the featured bulls
The "Semen Destacado" section of the home page SHALL show the featured bulls of every seller, reading real data instead of hardcoded samples. A bull SHALL only appear when it is featured and still has at least one `ACTIVE` straw.

#### Scenario: Sellers with featured bulls
- **WHEN** a visitor opens the home page and several sellers have a featured bull
- **THEN** the section shows one card per featured bull

#### Scenario: No featured bulls
- **WHEN** no seller has a featured bull
- **THEN** the section renders its empty state rather than sample data

#### Scenario: Unauthenticated visitor
- **WHEN** a visitor with no session opens the home page
- **THEN** the featured cards render complete, including the bull name, its breed and the seller's business name

### Requirement: The featured card presents the bull with its straw variants
Each featured card SHALL show the bull's cover image, the seller's business name, the bull's name with its breed, a selector of the bull's approved straw types, the price of the selected variant, and an action to add that variant to the cart. It SHALL use the existing colour palette.

#### Scenario: Selecting a variant
- **WHEN** the visitor picks a different straw type on the card
- **THEN** the displayed price becomes that variant's price

#### Scenario: Adding to the cart
- **WHEN** the visitor presses the add action
- **THEN** the selected variant is added to the cart honouring its minimum order quantity

#### Scenario: Variant out of stock
- **WHEN** the selected variant has no stock
- **THEN** the card marks it as unavailable and the add action is disabled

#### Scenario: Bull without a cover image
- **WHEN** the featured bull has no image
- **THEN** the card shows the catalog's placeholder instead of a broken image

### Requirement: The featured data is readable without a session
The system SHALL expose the data the featured cards need — bull, breed, seller business name, approved straws with their price and stock — to unauthenticated visitors, without exposing the seller's private fields such as contact phone or address.

#### Scenario: Anonymous read
- **WHEN** an unauthenticated client queries the featured data
- **THEN** it receives the featured bulls with their public fields

#### Scenario: Private fields stay private
- **WHEN** an unauthenticated client queries the featured data
- **THEN** the response contains no seller contact phone, address or any other private profile field
