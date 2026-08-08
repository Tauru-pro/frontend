## MODIFIED Requirements

### Requirement: The featured card presents the bull with its straw variants
The bull card SHALL show the bull's cover image, the seller's business name, the bull's name with its breed, a selector of the bull's approved straw types, the price of the selected variant, and an action to add that variant to the cart. It SHALL use the existing colour palette. The same component SHALL serve both the home page's featured section and the catalog's genetics section, so the two surfaces cannot drift apart.

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

#### Scenario: Same card in the catalog
- **WHEN** the visitor compares a card in the featured section with one in the catalog's genetics section
- **THEN** both render and behave identically

### Requirement: The featured data is readable without a session
The system SHALL expose the data the bull cards need — bull, breed, seller business name, approved straws with their price and stock — to unauthenticated visitors, without exposing the seller's private fields such as contact phone or address. The same public surface SHALL serve the featured section and the catalog, distinguishing them by a featured flag rather than by a separate view.

#### Scenario: Anonymous read
- **WHEN** an unauthenticated client queries the bull listings
- **THEN** it receives the bulls with approved straws and their public fields

#### Scenario: Reading only the featured ones
- **WHEN** a client filters the bull listings by the featured flag
- **THEN** it receives only the bulls their sellers marked as featured

#### Scenario: Private fields stay private
- **WHEN** an unauthenticated client queries the bull listings
- **THEN** the response contains no seller contact phone, address or any other private profile field
