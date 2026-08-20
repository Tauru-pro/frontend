## ADDED Requirements

### Requirement: Payment and payment-attempt persistence
The system SHALL persist one `payments` row per order-payment-intent and one `payment_attempts` row per retry, with `provider = 'WOMPI'`, a unique `provider_reference` per attempt, and a `provider_transaction_id` that is unique when present.

#### Scenario: Retrying a declined payment creates a new attempt
- **WHEN** a buyer retries payment on an order whose current payment is `DECLINED`
- **THEN** the system creates a new `payment_attempts` row with an incremented `attempt_number` and a new, never-before-used Wompi reference, without discarding the previous attempt's record

### Requirement: Wompi integrity signature generated server-side only
The system SHALL generate the Wompi integrity signature (`SHA256(reference + amount_in_cents + currency + integrity_secret)`) exclusively inside a Supabase Edge Function using the `WOMPI_INTEGRITY_SECRET`, and SHALL never transmit that secret, `WOMPI_EVENTS_SECRET`, or the Wompi service-role/private key to the Angular frontend.

#### Scenario: Checkout response contains no secrets
- **WHEN** `create-checkout` returns its response to the frontend
- **THEN** the response contains `publicKey` and `integritySignature` but no field named or containing `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, or any Wompi private key

### Requirement: Checkout creates an order and opens the Wompi Widget
The system SHALL let an authenticated buyer initiate payment for their cart, receiving a reference, amount in cents, currency, public key, and integrity signature to open the Wompi Widget, and SHALL transition the order to `PAYMENT_PROCESSING` once the widget is opened.

#### Scenario: Successful checkout initiation
- **WHEN** an authenticated buyer with a non-empty cart submits checkout with a fresh idempotency key
- **THEN** the system creates the order and payment, returns the Wompi Widget parameters, and the frontend opens the Wompi Widget

#### Scenario: Redirect is informational only
- **WHEN** the Wompi Widget or a Wompi redirect reports a transaction status to the frontend
- **THEN** the frontend displays an informational "verifying payment" state and does not mark the order as paid based on that reported status

### Requirement: Checkout idempotency
The system SHALL accept a client-generated idempotency key on checkout creation and SHALL enforce `UNIQUE(user_id, idempotency_key)`, returning the existing order/payment instead of creating a duplicate when the same key is submitted again.

#### Scenario: Double-click does not create two orders
- **WHEN** two checkout requests with the same `user_id` and `idempotencyKey` arrive in quick succession
- **THEN** the system creates exactly one order and one payment, and both requests receive the same order/payment identifiers in their response

#### Scenario: Refresh after order creation resumes the same order
- **WHEN** a buyer refreshes the browser after an order was created but before payment completes, and checkout is resubmitted with the same idempotency key
- **THEN** the system returns the existing `PENDING_PAYMENT` or `PAYMENT_PROCESSING` order rather than creating a new one

### Requirement: Webhook checksum validation
The system SHALL validate every incoming Wompi webhook by dynamically reading `signature.properties`, extracting the corresponding values from the event payload, concatenating them with the event `timestamp` and `WOMPI_EVENTS_SECRET`, computing a SHA-256 checksum, and comparing it to `signature.checksum`. A webhook whose checksum does not match SHALL be rejected without modifying any `orders` or `payments` row.

#### Scenario: Valid checksum is processed
- **WHEN** a webhook arrives whose computed checksum matches `signature.checksum`
- **THEN** the system proceeds to process the event

#### Scenario: Invalid checksum is rejected
- **WHEN** a webhook arrives whose computed checksum does not match `signature.checksum`
- **THEN** the system responds with `401` or `403`, logs the event, and does not update any order or payment

### Requirement: Webhook idempotency
The system SHALL record every received webhook in `webhook_events` with a uniqueness constraint that prevents the same event from producing more than one effective state change, regardless of how many times Wompi delivers it.

#### Scenario: Duplicate webhook delivery has no additional effect
- **WHEN** the same Wompi event (same `event_id`, or same `transaction_id` + `event_type` + `timestamp` when no `event_id` is provided) is delivered five times
- **THEN** the associated payment and order are updated exactly once across all five deliveries

### Requirement: Payment amount and reference validation
The system SHALL only apply an `APPROVED` transition when `wompi.amount_in_cents` equals `orders.total` converted to cents, and `wompi.reference` equals the `payments`/`payment_attempts` row's `provider_reference` looked up by that reference (not by `user_id` or `order_id` alone). A mismatch on either check SHALL prevent the `APPROVED` transition and flag the event for manual review instead.

#### Scenario: Amount mismatch blocks approval
- **WHEN** a webhook reports `amount_in_cents` that does not equal the order's total in cents
- **THEN** the system does not transition the payment to `APPROVED` and marks the event as requiring manual review

#### Scenario: Reference mismatch blocks approval
- **WHEN** a webhook's `reference` does not match any `payments`/`payment_attempts` row's `provider_reference`
- **THEN** the system does not transition any payment to `APPROVED` and marks the event as requiring manual review

### Requirement: Payment status state machine with forward-only, idempotent transitions
The system SHALL track payment status through `CREATED`, `PENDING`, `APPROVED`, `DECLINED`, `VOIDED`, `ERROR`, `EXPIRED`, treating `APPROVED`, `DECLINED`, `VOIDED`, `ERROR`, and `EXPIRED` as terminal, and SHALL apply a status update only when the payment's current status is one of the allowed source states for that transition.

#### Scenario: Approved payment cannot be overwritten by a later declined event
- **WHEN** a payment has already reached `APPROVED` and a subsequent (delayed) webhook reports `DECLINED` for the same transaction
- **THEN** the payment status remains `APPROVED`

#### Scenario: Concurrent conflicting webhooks resolve deterministically
- **WHEN** two webhooks for the same payment arrive nearly simultaneously, one reporting `APPROVED` and one reporting `DECLINED`
- **THEN** the update is applied conditionally on the payment's status at update time, so the first to commit wins and the second is a no-op rather than overwriting an already-terminal status

### Requirement: Reconciliation against the Wompi transactions API
The system SHALL periodically identify payments stuck in a non-terminal status beyond a threshold duration and query the Wompi transactions API directly to reconcile the local status, applying the same amount/reference validation as the webhook path.

#### Scenario: Reconciliation corrects a missed webhook
- **WHEN** a payment has been `PENDING` for longer than the reconciliation threshold and Wompi reports the transaction as `APPROVED`
- **THEN** the system applies the same validated approval transition it would apply from a webhook

### Requirement: Sandbox and production environment separation
The system SHALL use environment-specific Wompi credentials (public key, integrity secret, events secret, API URL) and webhook URLs for sandbox versus production, with no shared secret between the two.

#### Scenario: Sandbox event does not affect production credentials
- **WHEN** the system is configured with `WOMPI_ENVIRONMENT = SANDBOX`
- **THEN** it uses only the sandbox public key, integrity secret, and events secret, never the production equivalents
