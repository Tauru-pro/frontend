## Purpose

This capability defines the end-to-end shopping flow: adding products to a local cart, managing cart contents, and completing checkout. Cart state is persisted in `localStorage`. Checkout is a two-step flow that ends in order creation and redirect to a payment URL.

## Requirements

### Requirement: Buyer adds products to the cart
The system SHALL allow any user to add a product to a local cart, specifying a quantity not less than the product's `min_order_quantity`. The cart state SHALL be persisted in `localStorage` so it survives page reloads.

#### Scenario: Adding a product for the first time
- **WHEN** a user clicks "Agregar al carrito" on a product detail page with a valid quantity
- **THEN** the system adds a new cart item `{product, quantity}` to the cart store and persists the updated cart in `localStorage`

#### Scenario: Adding a product already in the cart
- **WHEN** a user adds a product that already exists in the cart
- **THEN** the system increments the quantity of the existing cart item by the specified amount

#### Scenario: Quantity below minimum order
- **WHEN** a user attempts to add a product with a quantity less than `min_order_quantity`
- **THEN** the system sets the quantity to `min_order_quantity` and adds the item

#### Scenario: Adding an out-of-stock product
- **WHEN** a product has `stock_quantity = 0`
- **THEN** the system prevents adding the product to the cart (the button is disabled)

### Requirement: Buyer manages cart contents
The system SHALL allow the buyer to view all cart items, update quantities, and remove individual items from the cart view at `/carrito`.

#### Scenario: Viewing cart
- **WHEN** a user navigates to `/carrito`
- **THEN** the system displays all cart items with product name, type, price per unit, quantity controls, subtotal per item, and the cart total

#### Scenario: Increasing item quantity
- **WHEN** a user clicks the quantity increment button on a cart item
- **THEN** the system increases the quantity by 1 and recalculates the totals

#### Scenario: Decreasing item quantity to zero
- **WHEN** a user decrements a cart item quantity to below the minimum order quantity
- **THEN** the system removes the item from the cart entirely

#### Scenario: Removing an item
- **WHEN** a user clicks "Eliminar" on a cart item
- **THEN** the system removes the item from the cart and updates the total

#### Scenario: Empty cart
- **WHEN** the cart has no items
- **THEN** the system shows an empty state and a "Ir al catálogo" link

### Requirement: Buyer completes checkout
The system SHALL guide the buyer through a two-step checkout: (1) contact information and location, (2) pickup point selection and order confirmation. Upon confirmation the system SHALL create an order and redirect to the payment URL.

#### Scenario: Accessing checkout with items
- **WHEN** a user with at least one item in the cart navigates to `/checkout`
- **THEN** the system shows step 1 with fields for full name, email, phone (optional), and a location selector (department + municipality)

#### Scenario: Accessing checkout with empty cart
- **WHEN** a user navigates to `/checkout` with an empty cart
- **THEN** the system redirects to `/carrito`

#### Scenario: Advancing to step 2
- **WHEN** a user completes the required fields in step 1 (name, email, location) and clicks "Siguiente"
- **THEN** the system shows step 2 with a list of pickup points filtered by the selected department

#### Scenario: Selecting a pickup point
- **WHEN** a user selects a pickup point in step 2
- **THEN** the system calculates and displays the shipping cost for that point and the grand total

#### Scenario: Confirming the order
- **WHEN** a user clicks "Confirmar pedido" with a pickup point selected
- **THEN** the system sends the order (contact info + pickup point + cart items) to the backend, clears the cart, and redirects to the payment URL

#### Scenario: Order creation failure
- **WHEN** the order creation endpoint returns an error
- **THEN** the system displays an error message and allows the user to retry without losing their form data
