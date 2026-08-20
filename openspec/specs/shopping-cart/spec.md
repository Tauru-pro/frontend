## Purpose

This capability defines the end-to-end shopping flow: adding products to a local cart, managing cart contents, and completing checkout. Cart state is persisted in `localStorage`. Checkout is a two-step flow that ends in order creation and opening the Wompi Widget for payment.

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
The system SHALL guide the buyer through a two-step checkout: (1) contact information and location, (2) pickup point selection and order confirmation. The frontend SHALL generate an idempotency key when the buyer first reaches step 2 and reuse it for every checkout submission of that same session. Upon confirmation the system SHALL call the `create-checkout` Supabase Edge Function and open the Wompi Widget using the returned reference, amount in cents, currency, public key, and integrity signature — the frontend SHALL NOT compute the order total, generate any Wompi signature, or navigate to a backend-provided `paymentUrl`.

#### Scenario: Accessing checkout with items
- **WHEN** a user with at least one item in the cart navigates to `/checkout`
- **THEN** the system shows step 1 with fields for full name, email, phone (optional), and a location selector (department + municipality)

#### Scenario: Accessing checkout with empty cart
- **WHEN** a user navigates to `/checkout` with an empty cart
- **THEN** the system redirects to `/carrito`

#### Scenario: Advancing to step 2
- **WHEN** a user completes the required fields in step 1 (name, email, location) and clicks "Siguiente"
- **THEN** the system shows step 2 with a list of pickup points filtered by the selected department, and generates an idempotency key for this checkout attempt if one does not already exist for the current session

#### Scenario: Selecting a pickup point
- **WHEN** a user selects a pickup point in step 2
- **THEN** the system calculates and displays the shipping cost for that point and the grand total

#### Scenario: Confirming the order opens the Wompi Widget
- **WHEN** a user clicks "Confirmar pedido" with a pickup point selected
- **THEN** the system calls `create-checkout` with the cart items, contact info, pickup point, and idempotency key, and on success opens the Wompi Widget with the returned payment parameters — the cart is not cleared until payment is confirmed

#### Scenario: Order creation failure
- **WHEN** the `create-checkout` function returns an error
- **THEN** the system displays an error message and allows the user to retry without losing their form data or generating a new idempotency key

#### Scenario: Resubmitting checkout after a refresh reuses the same order
- **WHEN** a buyer refreshes the browser mid-checkout and resubmits confirmation with the idempotency key restored from session storage
- **THEN** the system returns the same order created by the original submission instead of creating a duplicate, and re-opens the Wompi Widget for that order if it is still `PENDING_PAYMENT`

#### Scenario: Abandoning the Wompi Widget leaves the order pending
- **WHEN** a buyer closes the Wompi Widget without completing payment
- **THEN** the order remains `PENDING_PAYMENT`, the cart is not cleared, and the buyer can retry payment or let the order expire
