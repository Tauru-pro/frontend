## MODIFIED Requirements

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
