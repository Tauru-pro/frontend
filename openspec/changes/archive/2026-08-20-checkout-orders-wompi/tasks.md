## 1. Shipping rates migration to Supabase (prerequisite)

`ShippingRateService`/admin shipping-rates CRUD currently live entirely against `brackend` (`${apiUrl}/shipping-rates`), and `checkout.component.ts` also calls `brackend` (`OrderService.getShippingEstimate`) for the buyer-facing shipping preview. `create-checkout` cannot compute an authoritative total without this data in Supabase, so it moves first.

- [x] 1.1 Write `supabase/migrations/0030_shipping_rates_schema.sql`: `shipping_rates` (id, origin_state_id → states, destination_state_id → states, base_rate numeric, created_at, updated_at) with `UNIQUE(origin_state_id, destination_state_id)`, public `select` RLS (mirrors `breeds`/`pickup_points`), write restricted to `SUPER_ADMIN` via `user_role` JWT claim.
- [x] 1.2 In the same migration, add a `security definer` SQL function `public.get_shipping_estimate(p_pickup_point_id uuid, p_items jsonb)` returning `(seller_id, seller_name, origin_state_id, origin_state_name, shipping_cost)` — one row per distinct seller in the cart, joining each seller's main `branches` row → `cities` → `states` as origin, the pickup point's `cities` → `states` as destination, and `shipping_rates` for the cost (`coalesce(base_rate, 0)` when no rate is configured for that pair). Grant `execute` to `authenticated` (buyer-facing preview) — this is the single source of truth both the preview and `create-checkout` call, so the formula never drifts between the two.
- [x] 1.3 Rewrite `core/models/shipping-rate.model.ts`/`core/services/shipping-rate.service.ts` to use `supabase-js` (`from('shipping_rates')...`) instead of `HttpClient`/`apiUrl`, following the `PickupPointService` pattern (row mapper, `origin`/`destination` joined via `states(id, name)`).
- [x] 1.4 Update `features/backoffice/shipping-rates/shipping-rates.component.ts` and `shipping-rate-form.component.ts` only as needed for the rewritten service's return types/error shapes (e.g. Postgres unique-violation instead of HTTP 409 for a duplicate origin/destination pair).
- [ ] 1.5 Manually verify: admin can create/edit/delete rates; a buyer (authenticated, non-admin) can call `get_shipping_estimate` via RPC but cannot write to `shipping_rates` directly.

## 2. Database schema

- [x] 2.1 Write `supabase/migrations/0031_orders_schema.sql`: `orders` (id, user_id, status, currency, subtotal, tax, shipping_cost, discount, total, idempotency_key, created_at, updated_at, expires_at, paid_at, cancelled_at, completed_at) with `UNIQUE(user_id, idempotency_key)`, `status` check constraint, RLS (`select` for `auth.uid() = user_id`, no client `insert`/`update`/`delete`), and `order_items` (id, order_id, product_id, product_name, product_variant_id, quantity, unit_price, subtotal, created_at) with RLS inherited via `order_id` join to `orders.user_id`.
- [x] 2.2 Write `supabase/migrations/0032_payments_schema.sql`: `payments` (id, order_id, provider, provider_transaction_id UNIQUE nullable, provider_reference UNIQUE, status, amount, currency, payment_method, failure_reason, raw_response, created_at, updated_at, approved_at) and `payment_attempts` (id, payment_id, attempt_number, reference, provider_transaction_id, status, amount, created_at, completed_at), both RLS-read-only for the owning buyer via `order_id`/`payment_id` join, no client writes.
- [x] 2.3 Write `supabase/migrations/0033_webhook_events_schema.sql`: `webhook_events` (id, provider, event_type, event_id, transaction_id, payload jsonb, checksum, environment, received_at, processed_at, processing_status, error_message) with the dedupe unique index from design Decision 7; RLS enabled with no client-facing policies (service_role only).
- [x] 2.4 Write `supabase/migrations/0034_order_status_history.sql`: `order_status_history` (id, order_id, from_status, to_status, reason, source, metadata jsonb, created_at) plus an `AFTER UPDATE OF status ON orders` trigger that inserts a row automatically; RLS read-only for the owning buyer.
- [x] 2.5 Write `supabase/migrations/0035_order_state_transition_guards.sql`: `BEFORE UPDATE` triggers on `orders` and `payments` that raise an exception on any transition out of a terminal status (per design Decision 5), plus `alter publication supabase_realtime add table orders, payments;`.
- [ ] 2.6 Apply migrations to the local/dev Supabase project and manually verify RLS: as an authenticated buyer, confirm `select` on another user's `orders` row returns nothing, and confirm `insert`/`update` on `orders`/`payments` from the client (anon/authenticated key) is rejected.

## 3. Shared Edge Function utilities

- [x] 3.1 Write `supabase/migrations/0036_order_payment_transition_functions.sql`: `security definer` SQL functions `apply_payment_approved`, `apply_payment_failed`, `expire_order` that atomically update `payments` + `orders` (+ restore stock where applicable) in one transaction, tagging `order_status_history` via `set_config('app.status_change_source', ...)` (design Decision 4b) — granted to `service_role` only.
- [x] 3.2 Add `supabase/functions/_shared/money.ts`: `toCents(pesos)`/`fromCents(cents)` helpers, used by every function that talks to Wompi.
- [x] 3.3 Add `supabase/functions/_shared/wompi-client.ts`: thin fetch wrapper for the Wompi API (`GET /v1/transactions/{id}`), reading `WOMPI_API_URL`/`WOMPI_ENVIRONMENT` from env.
- [x] 3.4 Add `supabase/functions/_shared/wompi-signature.ts`: `buildIntegritySignature(reference, amountInCents, currency, secret)` and `verifyEventChecksum(payload, secret)` (dynamic `signature.properties` extraction per design Decision 6).
- [x] 3.5 Add `supabase/functions/_shared/order-transitions.ts`: thin wrapper around the `0036` RPC functions (`applyApprovedPayment`, `applyDeclinedOrErrorPayment`, `expireOrder`), used by `wompi-webhook`, `reconcile-payments`, and `expire-orders`.

## 4. `create-checkout` Edge Function

- [x] 4.1 Write `supabase/migrations/0037_create_order_function.sql`: `security definer` RPC `create_order_with_items(p_idempotency_key, p_pickup_point_id, p_items jsonb)` that reads `auth.uid()` directly, resolves idempotency, locks/validates products (`FOR UPDATE`), computes totals, calls `get_shipping_estimate` internally, and atomically inserts `orders`/`order_items`/decrements stock/inserts `payments`+first `payment_attempts` row (design Decision 4) — granted to `authenticated`.
- [x] 4.2 Scaffold `supabase/functions/create-checkout/index.ts` (JWT required; client built with the anon key + the request's `Authorization` header forwarded, so `auth.uid()` resolves inside the RPC; CORS headers matching `product-validate`'s pattern).
- [x] 4.3 Call `create_order_with_items` via `.rpc(...)`; on its returned `(order_id, payment_id, reference, currency, total, is_existing)`, compute the Wompi integrity signature via `_shared/wompi-signature.ts` using `WOMPI_INTEGRITY_SECRET`.
- [x] 4.4 Return the response shape from design Decision 4 (`orderId`, `paymentId`, `reference`, `currency`, `amountInCents`, `publicKey`, `integritySignature`, `redirectUrl`) — verify no secret is present in the response body.
- [ ] 4.5 Deploy (`supabase functions deploy create-checkout`) and manually test: unavailable product, insufficient stock, price-tampering attempt, duplicate idempotency key.

## 5. `wompi-webhook` Edge Function

- [x] 5.1 Scaffold `supabase/functions/wompi-webhook/index.ts` (no JWT required — public Wompi endpoint — but checksum-validated).
- [x] 5.2 Validate payload structure and environment (`sandbox`/`production` matches configured `WOMPI_ENVIRONMENT`); reject malformed payloads with `400` without touching `webhook_events`.
- [x] 5.3 Validate checksum via `_shared/wompi-signature.ts`; on mismatch, insert a `webhook_events` row with `processing_status = 'CHECKSUM_INVALID'` and respond `401`.
- [x] 5.4 Insert into `webhook_events` using the dedupe unique constraint; on unique-violation, respond `200` immediately (already processed).
- [x] 5.5 Look up the `payments`/`payment_attempts` row by `provider_reference = wompi.reference` (not by `order_id`/`user_id`); if not found, mark `processing_status = 'REVIEW_REQUIRED'` and respond `200` without further action.
- [x] 5.6 Validate `wompi.amount_in_cents == orders.total * 100` and currency; on mismatch, mark `processing_status = 'REVIEW_REQUIRED'`, do not transition status.
- [x] 5.7 On valid `APPROVED`: call `_shared/order-transitions.ts` to atomically move `payments` `CREATED|PENDING → APPROVED` and `orders` `PAYMENT_PROCESSING → PAID`, setting `approved_at`/`paid_at`.
- [x] 5.8 On valid `DECLINED`/`ERROR`/`VOIDED`: transition `payments` accordingly and `orders → PAYMENT_FAILED`, restore reserved stock for the order's items.
- [x] 5.9 Mark `webhook_events.processed_at`/`processing_status = 'PROCESSED'` at the end; respond `200`.
- [ ] 5.10 Deploy and register the sandbox webhook URL in the Wompi dashboard; manually test duplicate delivery, out-of-order `APPROVED`-then-`DECLINED`, and checksum tampering.

## 6. `get-payment-status` and `retry-payment` Edge Functions

- [x] 6.1 Implement `supabase/functions/get-payment-status/index.ts` (`GET`, JWT required, anon key + forwarded `Authorization` header so RLS scopes the read to the caller's own order/payments).
- [x] 6.2 Write `supabase/migrations/0038_retry_payment_function.sql`: `security definer` RPC `retry_payment(p_order_id)` — same atomic-transaction rationale as `create_order_with_items` — verifying the order belongs to `auth.uid()` and its payment is in a terminal failure state (`DECLINED`/`ERROR`/`VOIDED`/`EXPIRED`), inserting a new `payment_attempts` row with a fresh, never-reused reference, and transitioning `orders` back to `PAYMENT_PROCESSING`.
- [x] 6.3 Implement `supabase/functions/retry-payment/index.ts`: call `retry_payment` via `.rpc(...)` (anon key + forwarded JWT), compute a new Wompi integrity signature, and return the same response shape as `create-checkout`.
- [ ] 6.4 Deploy both and manually test retry-after-decline end to end against sandbox.

## 7. Scheduled reconciliation and expiration

- [ ] 7.1 Confirm whether `pg_cron`/`pg_net` are enabled on this Supabase project (design Open Question); if unavailable, plan an external scheduler (e.g. GitHub Actions cron) instead.
- [x] 7.2 Implement `supabase/functions/expire-orders/index.ts`: find `PENDING_PAYMENT` orders past `expires_at`, transition to `EXPIRED`, restore stock.
- [x] 7.3 Implement `supabase/functions/reconcile-payments/index.ts`: find `payments` stuck `PENDING`/`CREATED` beyond a threshold, call `_shared/wompi-client.ts` to fetch the live transaction, and apply `_shared/order-transitions.ts` with the same validation as the webhook path.
- [ ] 7.4 Schedule both (via `pg_cron` calling the function URL through `pg_net`, or the external scheduler chosen in 7.1).

## 8. Supabase secrets and environment separation

- [ ] 8.1 Set sandbox secrets via `supabase secrets set`: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_ENVIRONMENT=SANDBOX`, `WOMPI_API_URL`.
- [x] 8.2 Document the production cutover step (separate secret values + separate webhook URL registration) in `supabase/README.md`, to be executed only when explicitly requested — not part of this implementation pass.

## 9. Frontend: models and services

- [x] 9.1 Add `core/models/order.model.ts` (`Order`, `OrderItem`, `PaymentSummary`, `CreateCheckoutRequest`, `CheckoutPaymentIntent`, `ShippingEstimate`) — a dedicated model file rather than extending `cart.model.ts`, since `CheckoutFromCartDto`/`OrderResponse` there are still used by the pre-existing (unused-but-untouched) `cart.service.ts`.
- [x] 9.2 Rewrite `core/services/order.service.ts` to call the Supabase Edge Functions (`supabase.functions.invoke('create-checkout', ...)`, `retry-payment`) and to query `orders`/`order_items`/`payments` directly via `supabase.from(...)` for the dashboard/detail views, instead of `HttpClient` against `apiUrl`; replace `getShippingEstimate` with a call to the `get_shipping_estimate` RPC from task 1.2.
- [x] 9.3 Add `core/services/payment.service.ts` wrapping `get-payment-status` and Realtime subscriptions on `payments`/`orders`.
- [x] 9.4 Add `core/services/wompi-checkout.service.ts`: browser-only (guarded like `SupabaseClientService`) lazy-loader for `https://checkout.wompi.co/widget.js`, exposing `open(params, onResult)`.

## 10. Frontend: checkout flow

- [x] 10.1 Add idempotency-key generation/persistence to `CheckoutFormState`/`sessionStorage` in `checkout.component.ts`, generated once on advancing to step 2. Cleared once `create-checkout` successfully returns an order and checkout hands off to `/checkout/result` (so a pre-navigation refresh/retry still dedupes via the same key, but a later fresh visit to `/checkout` always starts a new key) — refined from "cleared only on terminal success" during implementation, since the checkout component is torn down at that handoff regardless of payment outcome.
- [x] 10.2 Replace `confirm()`'s `orderService.checkoutFromCart(...)` + `window.location.href = order.paymentUrl` with a call to the rewritten `OrderService`/`create-checkout`, followed by `WompiCheckoutService.open(...)`; do not clear the cart until payment is confirmed.
- [x] 10.3 Handle the widget's abandon/close callback: navigate to `/checkout/result`, which is where "order still pending / retry" is actually shown (task 11) — the order itself is untouched (stays `PENDING_PAYMENT`/whatever the webhook last set) and the cart stays intact since `confirm()` never clears it.
- [x] 10.4 Handle `create-checkout` returning an existing order (idempotent resume case): no special-casing needed — the backend already returns the same order/reference/signature transparently, so `WompiCheckoutService.open(...)` re-opens the widget for the resumed order exactly like a fresh one.

## 11. Frontend: checkout result page

- [x] 11.1 Add `features/marketplace/checkout/result/result.component.ts` at route `/checkout/result`, reading `orderId` from query params.
- [x] 11.2 Subscribe to Realtime changes on the order/payment and/or poll `get-payment-status`; render "verificando tu pago" while `PAYMENT_PROCESSING`, and the terminal outcome (`PAID`/`PAYMENT_FAILED`) once reached — never derive the outcome from widget/redirect data directly.
- [x] 11.3 Clear the cart only once the order is confirmed `PAID` (moved from `confirm()` per task 10.2).

## 12. Frontend: "Mis compras" dashboard

- [x] 12.1 Add a new route (list) under the marketplace area, e.g. `features/marketplace/orders/orders-list.component.ts`, showing the buyer's own orders (number, date, status, total) via the rewritten `OrderService`.
- [x] 12.2 Add an order-detail route with a dynamic `:id` segment (products, subtotal, discounts, taxes, total, order status, payment status, payment method).
- [x] 12.3 Register the new `:id` order-detail route in `app.routes.server.ts` with `RenderMode.Server` (per this repo's SSR convention for dynamic routes).
- [x] 12.4 Add a nav link to "Mis compras" in the buyer-facing navbar.
- [x] 12.5 Wire Realtime subscription on the detail view so status changes (e.g. `PAID → PROCESSING`) update live.

## 13. End-to-end verification against the resilience matrix

- [ ] 13.1 Double-click "Pagar": confirm exactly one order/payment is created.
- [ ] 13.2 Two tabs checking out the same cart: confirm no duplicate order for the same idempotency key.
- [ ] 13.3 Refresh mid-checkout and mid-payment: confirm the flow resumes the same order.
- [ ] 13.4 Abandon the Wompi Widget: confirm the order stays `PENDING_PAYMENT` and can be retried or left to expire.
- [ ] 13.5 Approve a payment then close the browser before redirect: confirm the webhook still marks the order `PAID` and it's visible in "Mis compras" on next visit.
- [ ] 13.6 Send the same webhook event multiple times: confirm one effective change.
- [ ] 13.7 Send a webhook with a tampered checksum: confirm no DB change and a `401`/`403`.
- [ ] 13.8 Send a webhook with a mismatched amount and a mismatched reference (separately): confirm both are flagged for review and never auto-approved.
- [ ] 13.9 Send `APPROVED` followed by a delayed `DECLINED` for the same transaction: confirm the payment stays `APPROVED`.
- [ ] 13.10 Let a `PENDING_PAYMENT` order pass `expires_at` without payment: confirm it transitions to `EXPIRED` and stock is restored.
- [ ] 13.11 Retry a `DECLINED` payment: confirm a new attempt/reference is used and the order can reach `PAID`.
