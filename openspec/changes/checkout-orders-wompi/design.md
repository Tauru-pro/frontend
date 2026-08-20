## Context

Every other domain in this app (bulls, products, sellers, pickup points, geography) is modeled directly in Supabase Postgres with RLS and consumed from Angular via `@supabase/supabase-js`, with Edge Functions handling privileged/service-role operations (`product-validate`, `seller-document-validate`, `admin-create-user`, `seller-self-onboard`, `send-welcome`). Checkout is the one flow still hard-wired to a separate NestJS backend (`brackend`, reached through `environment.apiUrl`) that this repo does not own: `OrderService.checkoutFromCart()` posts to `${apiUrl}/orders/checkout` and gets back `{ id, paymentUrl }`; `getShippingEstimate()` also hits `apiUrl`. There is no order/payment persistence in Supabase today, no Wompi integration anywhere, and no way for a buyer to see past orders.

Auth in this repo is Supabase Auth (`SupabaseClientService` wraps `@supabase/supabase-js`, `AuthService` calls `supabase.auth.*`), with `profiles.role` injected into the JWT as `user_role` via `custom_access_token_hook` (migration `0003`). `auth.uid()` is the canonical user id used by every existing RLS policy (e.g. `customer_profiles.user_id`). The cart itself (`CartStore`) is purely client-side, persisted to `localStorage`, and is never sent to a backend except at checkout time — there is no server-side cart table.

Constraints carried over from the pasted proposal and from this decision (Q&A: this change targets Supabase Edge Functions, not `brackend`):
- The frontend must never see `WOMPI_INTEGRITY_SECRET` / `WOMPI_EVENTS_SECRET` / service-role keys.
- The backend must own pricing, totals, and the Wompi integrity signature.
- Order/payment state transitions must be idempotent and forward-only.
- `brackend`'s existing `/orders/checkout` and `/orders/shipping-estimate` are out of scope — not modified, not called after this change ships.

## Goals / Non-Goals

**Goals:**
- Persist orders/order-items/payments/payment-attempts/webhook-events/order-status-history in Supabase Postgres, RLS-protected, mirroring the migration style already used (`0028_pickup_points_schema.sql` etc.).
- Provide `create-checkout`, `wompi-webhook`, `get-payment-status`, `retry-payment` Edge Functions, following the existing pattern (`Deno.serve`, `service_role` client, CORS headers, JWT decode) seen in `product-validate`.
- Make the backend the sole source of truth for price, total, shipping cost, and payment status — Angular only reads and displays.
- Support the Wompi Widget (`widget.js`) for in-app payment, with `/checkout/result` as a purely informational landing page.
- Handle the resilience matrix from the proposal: double-click, multi-tab, refresh, webhook retries/duplicates, delayed/out-of-order events, amount/reference mismatches, browser closed mid-payment, expiration, retry-after-decline.
- Add a buyer "Mis compras" dashboard with Supabase Realtime updates.

**Non-Goals (this change):**
- Refunds/partial payments/split payments — schema leaves room (`REFUND_PENDING`/`REFUNDED`/`REFUND_FAILED` values reserved on `payments.status` check constraint comment) but no refund flow is implemented.
- Inventory *reservation* locking beyond a straightforward `stock_quantity` decrement at order creation and restock on expire/decline — no distributed lock, no oversell protection for extreme concurrency (documented as an Open Question).
- Seller payouts / marketplace splits.
- Migrating or touching the `brackend` NestJS service.
- Multiple payment attempts running concurrently for the same order (the UI disables "Pagar" while a `PAYMENT_PROCESSING` attempt is outstanding; a new attempt is only offered after the previous one reaches a terminal failure state).

## Decisions

### 1. Tables live in `public`, migrated as new numbered files starting at `0030`
Follow the existing convention exactly (`create table if not exists public.x`, `timestamptz not null default now()`, `set_updated_at()` trigger reused from `0005`, RLS policies checking `auth.jwt() ->> 'user_role'` / `auth.uid()`). New files:
- `0030_orders_schema.sql` — `orders`, `order_items`
- `0031_payments_schema.sql` — `payments`, `payment_attempts`
- `0032_webhook_events_schema.sql` — `webhook_events`
- `0033_order_status_history.sql` — `order_status_history` + trigger that appends a row on every `orders.status` change
- `0034_order_state_transition_guards.sql` — `BEFORE UPDATE` triggers on `orders`/`payments` enforcing the allowed-transition table (see Decision 5), so an invalid transition is rejected at the database layer regardless of which Edge Function attempts it.

**Alternative considered**: a single JSON `status_history` column on `orders`. Rejected — harder to query/audit, and `order_status_history` as its own table matches how the rest of the schema favors normalized tables over JSON blobs.

### 2. Money stored as integer pesos (COP), converted to `amount_in_cents` only at the Wompi boundary
`orders.total`, `order_items.unit_price`, `payments.amount` are `integer` (COP has no subunit in practice here; existing `products.price` is `numeric(14,2)` but always whole pesos in this catalog). `create-checkout` and `wompi-webhook` multiply by 100 when talking to Wompi and divide when comparing back. This mirrors proposal §7/§25 (never compare cents-to-pesos without an explicit, single conversion point).

**Alternative considered**: store everything in cents end-to-end. Rejected — every other price field in this codebase (`products.price`, `PricePipe`) is whole pesos; converting the entire display layer is unnecessary churn for a domain that doesn't need sub-peso precision.

### 3. Idempotency key flows from `CartStore` → `orders.idempotency_key`, unique per user
`CartStore` (or a new small `CheckoutStore`) generates a UUID the first time the buyer reaches step 2 of checkout and persists it in the same `sessionStorage` blob already used for `CHECKOUT_STORAGE_KEY`. `create-checkout` upserts on `UNIQUE(user_id, idempotency_key)`: if a row already exists for that key, it returns the existing order/payment instead of creating a new one (covers double-click, double-tab, and refresh-then-resubmit). The key is cleared from storage only after the order reaches a terminal success (`PAID`+) or the buyer explicitly starts a new checkout from an empty cart.

**Alternative considered**: dedupe purely via a DB advisory lock keyed on cart contents hash. Rejected — doesn't handle "same cart, deliberately different order" (buyer paid, cart was cleared, buyer adds items again) and is harder to reason about than a single client-generated key with a unique constraint, which is also what the pasted proposal specifies.

### 4. `create-checkout` recomputes everything server-side; it trusts only `product_id` + `quantity` from the request body
The actual order/item/payment creation is one atomic `security definer` RPC, `create_order_with_items` (migration `0037`, same rationale as Decision 4b): it reads `auth.uid()` directly (not a client-supplied `user_id`) → resolves idempotency (returns the existing order/payment if `(auth.uid(), idempotency_key)` already exists) → locks and validates each `product_id` (`FOR UPDATE`, must be `status = 'ACTIVE'`, `stock_quantity >= quantity`) → sums `price * quantity` per line → calls `get_shipping_estimate` internally for the shipping cost (Decision 4a) → inserts `orders` (`PENDING_PAYMENT`, snapshotted totals, `expires_at`), `order_items` (snapshotting `product_name`/`unit_price`), decrements `products.stock_quantity`, inserts `payments` (`CREATED`) with a generated reference, and inserts the first `payment_attempts` row — all in one transaction. Because it's `security definer` and keys off `auth.uid()`, the Edge Function calls it with the *caller's own JWT forwarded* (anon key + `Authorization` header from the request), not a service-role client — the function's elevated privilege covers the `products` write, RLS still correctly scopes everything to the calling buyer. The Edge Function itself only computes the Wompi integrity signature (`SHA256(reference + amount_in_cents + currency + WOMPI_INTEGRITY_SECRET)`, which does need the Edge Function's server-side secret) from the RPC's return value and shapes the proposal §19 response — it never touches `orders`/`payments` tables directly.

### 4a. Shipping-rate data moves into Supabase first, as a single SQL function shared by preview and checkout
Discovered during implementation: `core/services/shipping-rate.service.ts` (admin CRUD) and `OrderService.getShippingEstimate()` (buyer-facing checkout preview) both still call `brackend` (`${apiUrl}/shipping-rates`, `${apiUrl}/orders/shipping-estimate`) — there is no `shipping_rates` table in Supabase. Since `create-checkout` must own the authoritative total, this data has to live in Supabase before `create-checkout` can be built. Resolution (user-confirmed): add `public.shipping_rates` (`origin_state_id`, `destination_state_id`, `base_rate`, `UNIQUE(origin_state_id, destination_state_id)`), migrate the admin CRUD to `supabase-js` (same pattern as `PickupPointService`), and add one `security definer` SQL function, `public.get_shipping_estimate(p_pickup_point_id uuid, p_items jsonb)`, granted to `authenticated`. Both the buyer-facing checkout preview (`selectPickupPoint()`, an RPC call) and `create-checkout` (the authoritative total, same RPC call) invoke this one function — the formula exists in exactly one place, so preview and charge can never drift apart. The function groups by seller (one `shipping_rates` lookup per distinct seller in the cart, via that seller's main `branches` row as origin), matching the existing `Breakdown[]` shape (`sellerId`, `sellerName`, `originState`, `shippingCost`).

**Alternative considered**: have `create-checkout` call `brackend`'s existing `/orders/shipping-estimate` server-to-server. Rejected — reintroduces the exact cross-system dependency this change exists to remove, and `brackend` was explicitly out of scope for this change (user-confirmed).

### 4b. Payment/order transitions execute as atomic Postgres RPC functions, not two separate `supabase-js` calls
Discovered during implementation: `payments.status = 'APPROVED'` and `orders.status = 'PAID'` must change together, but two separate `supabase-js` `.update()` calls are two separate PostgREST requests/transactions — a crash between them could leave a payment `APPROVED` with its order stuck in `PAYMENT_PROCESSING` forever. Resolution: `apply_payment_approved`, `apply_payment_failed`, and `expire_order` are `security definer` SQL functions (migration `0036`) that perform the conditional `WHERE status IN (...)` update on `payments` *and* the corresponding `orders` update (plus stock restore where applicable) inside one PL/pgSQL function body — one Postgres transaction, one RPC call. `_shared/order-transitions.ts` is a thin wrapper that calls these via `.rpc(...)`; `wompi-webhook`, `reconcile-payments`, and `expire-orders` never issue the raw table updates directly. This also solves passing `source`/`reason` into `order_status_history` (0034's trigger reads `current_setting('app.status_change_source', ...)`) — `set_config(...)` and the UPDATE now run in the same session because they're in the same function body.

### 4c. `create_order_with_items` must itself advance the order to `PAYMENT_PROCESSING` — found via a live sandbox test
Bug caught against real Wompi sandbox traffic: `create_order_with_items` (0037, as originally written) inserted every order as `PENDING_PAYMENT` and left it there — nothing ever moved it to `PAYMENT_PROCESSING`. Since `apply_payment_approved`'s orders `UPDATE` only fires `WHERE status = 'PAYMENT_PROCESSING'` (Decision 4b/5), that update silently matched zero rows: `payments.status` correctly became `APPROVED`, but `orders.status` stayed stuck at `PENDING_PAYMENT` forever, even for a fully approved payment. Every buyer-facing symptom this produced (order shows "pending" while payment shows "approved"; checkout-result page stuck on "pending" after closing the widget; cart never clears — `result.component.ts`'s `clearCartOnce()` is correctly gated on the order reaching `PAID`+, so it just never fired) traced back to this one missing transition.

Fix (migration `0039`): `create_order_with_items` now advances `PENDING_PAYMENT → PAYMENT_PROCESSING` itself, in the same transaction, immediately after the payment/`payment_attempts` row is created — that moment (a Wompi reference now exists) is exactly what "checkout started" means (proposal §5). This also exposed that `expire_order`/`expire-orders` only ever looked at `PENDING_PAYMENT`, which — once orders correctly advance past it almost instantly — would have made the expiration sweep permanently unable to find anything to expire; `0039` broadens both to also match `PAYMENT_PROCESSING`, the real resting state for an abandoned/never-completed checkout.

### 4d. `retry_payment` had an ambiguous column reference — caught once error logging was improved
`retry-payment/index.ts` was returning a bare `500 INTERNAL_ERROR` with no way to tell why. Following the same "log everything Postgres gives us" fix already applied to `wompi-webhook` (Decision 6), `retry-payment` was updated to log `error.code`/`error.details`/`error.hint`, not just `error.message` — the very next attempt showed `column reference "payment_id" is ambiguous`. Cause: `retry_payment`'s `RETURNS TABLE (payment_id uuid, ...)` declares `payment_id` as an output variable in scope for the whole function body, and the attempt-number lookup (`select ... from payment_attempts where payment_id = v_payment.id`) used that same bare name to mean the *column* — Postgres can't disambiguate an identifier that's simultaneously a PL/pgSQL variable and a column name in the query's scope. Fix (migration `0040`): qualify it as `payment_attempts.payment_id`. `create_order_with_items` (0037) never had this problem despite sharing several of the same output-parameter names (`order_id`, `payment_id`, `reference`, `currency`, `total`) — every place it touches those columns already goes through a table alias (`o.id`, `p.id`, etc.) or a `v_`-prefixed local variable, so no bare identifier ever collided.

### 5. Explicit state machines enforced twice: in Edge Function logic and as a DB trigger backstop
```
orders.status:    CREATED → PENDING_PAYMENT → PAYMENT_PROCESSING → PAID → PROCESSING → SHIPPED → COMPLETED
                                     ↘ EXPIRED              ↘ PAYMENT_FAILED → (retry) → PAYMENT_PROCESSING
                                                             ↘ CANCELLED
payments.status:  CREATED → PENDING → APPROVED (terminal)
                                    ↘ DECLINED (terminal, retryable via new payment_attempts row)
                                    ↘ ERROR (terminal, retryable)
                                    ↘ VOIDED (terminal)
                                    ↘ EXPIRED (terminal)
```
`wompi-webhook` updates with `WHERE status IN (<allowed source states>)` (proposal §29) so a UPDATE affecting 0 rows means "already terminal, no-op" rather than an error — this is what makes repeated/out-of-order webhook delivery safe. The `0035` trigger additionally raises an exception on any UPDATE that violates the invariant below, as a backstop against a future bug in application code. Note this is deliberately narrower than "every non-terminal-looking status is frozen": `payment_attempts`/retry (Decision 10) means a `payments` row legitimately cycles `DECLINED → CREATED/PENDING → ...` across attempts, so only the one invariant that actually protects money is enforced at the DB layer:
- `payments`: once `status = 'APPROVED'`, no further UPDATE may change `status` away from `'APPROVED'` — this is the one transition that must never happen, since it's the "money was already approved" fact. `DECLINED`/`ERROR`/`VOIDED`/`EXPIRED` are terminal *for that attempt* but not frozen at the DB layer, since `retry-payment` legitimately moves the same `payments` row back to `CREATED`/`PENDING` for a new attempt.
- `orders`: once `status` is `PAID` or later in the fulfillment sequence (`PAID`/`PROCESSING`/`SHIPPED`/`COMPLETED`), no UPDATE may move it back to `PENDING_PAYMENT`/`PAYMENT_PROCESSING`. `COMPLETED` and `CANCELLED` are fully terminal — no further status change at all.

### 6. Webhook checksum validated dynamically against `signature.properties`, never a hardcoded field list
Per proposal §23, Wompi's event payload includes `signature.properties` (an array of dot-paths into the event, e.g. `transaction.id`, `transaction.status`, `transaction.amount_in_cents`) and `timestamp`. `wompi-webhook` reads that array, extracts each value from the payload in order, concatenates with the `timestamp` and `WOMPI_EVENTS_SECRET`, SHA-256s, and compares to `signature.checksum`. A mismatch returns `401` and writes a `webhook_events` row with `processing_status = 'CHECKSUM_INVALID'` but touches no `orders`/`payments` row.

**Environment label is logged, not enforced (discovered against real sandbox traffic):** the first live sandbox test hard-failed every event with `ENVIRONMENT_MISMATCH`, because `payload.environment`'s exact string (Wompi doesn't document it precisely — observed values look like `"test"`, not `"SANDBOX"`) didn't match the `WOMPI_ENVIRONMENT` secret's value. The real separation between sandbox and production is Wompi's own recommended mechanism — a distinct events URL per environment — not this payload field. `wompi-webhook` now normalizes common aliases (`TEST`/`SANDBOX`/`UAT`/`STAGING` → `SANDBOX`, `PRODUCTION`/`PROD`/`LIVE` → `PRODUCTION`) and only logs a warning on a residual mismatch — it never blocks a checksum-valid, correctly-referenced event over an environment-label guess being wrong. Blocking a real payment is a worse failure mode than logging an oddly-labeled one.

### 7. `webhook_events` dedupe key: `UNIQUE(provider, event_id)` when Wompi provides one, else `UNIQUE(provider, transaction_id, event_type, timestamp)`
Insert-then-check: attempt the insert, and on unique-violation, treat the event as already processed and return `200` immediately without touching `payments`/`orders` again (proposal §11/§39 "duplicate webhook → 1 effective change").

### 8. Amount/reference/currency mismatch → `payments.status` stays `PENDING`, a new `payment.failure_reason = 'PAYMENT_REVIEW_REQUIRED'` sentinel is recorded, and the row is flagged for manual review — never auto-approved
Concretely: `wompi.reference` must equal `payments.provider_reference` for the *current* attempt (looked up by reference, not by `order_id`/`user_id` — proposal §26), and `wompi.amount_in_cents` must equal `orders.total * 100` (proposal §25) before any `APPROVED` transition is applied. On mismatch, `webhook_events.processing_status = 'REVIEW_REQUIRED'` and the event is logged with enough detail (`raw_response`) for manual reconciliation; no automated retry attempts to "fix" a mismatch.

### 9. Frontend integration: Wompi Widget script loaded lazily, only in the browser
A small `WompiCheckoutService` (browser-only, guarded like `SupabaseClientService`/Amplify init) injects `https://checkout.wompi.co/widget.js` once and opens `new WidgetCheckout({...}).open(callback)` with the fields `create-checkout` returned. The widget's callback is used only to show a "verificando tu pago" UI state and to trigger a `get-payment-status` poll/Realtime subscription — never to mark anything paid (proposal §21, "redirect is UX only"). `redirectUrl` is set to `${origin}/checkout/result?orderId=...` for the flows where Wompi does a full redirect instead of the callback (mobile wallets, PSE).

### 10. Realtime: Angular subscribes to `postgres_changes` on `orders`/`payments` filtered by `id=eq.<orderId>` (checkout/result page) and `user_id=eq.<uid>` (dashboard)
Requires enabling Realtime on both tables (`alter publication supabase_realtime add table orders, payments;` in the migration) and RLS already covers the subscription (Realtime respects RLS on `postgres_changes`).

### 11. Expiration and reconciliation as scheduled Edge Functions, invoked via `pg_cron` → `pg_net`
`expire-orders`: `UPDATE orders SET status='EXPIRED' WHERE status='PENDING_PAYMENT' AND expires_at < now()`, restores `stock_quantity` for its `order_items`. `reconcile-payments`: selects `payments` in `PENDING`/`CREATED` older than N minutes, calls `GET {WOMPI_API_URL}/v1/transactions/{provider_transaction_id}` and applies the same validated-transition logic as the webhook path (reusing a shared `_shared/apply-transaction.ts` module) — this is the safety net for lost webhooks (proposal §24/§45). Scheduling matches the existing `supabase/functions` deployment model; no new infra beyond `pg_cron`/`pg_net` extensions (already available on Supabase-hosted projects).

## Risks / Trade-offs

- **[Risk]** Server-side shipping-cost calculation is being ported from `brackend` without that code in front of us → **Mitigation**: treat `getShippingEstimate` parity as an explicit task with its own review; keep the existing `PickupPointService`/pickup-points table as the source of pickup-point data (already in Supabase) so only the cost formula itself needs porting.
- **[Risk]** DB-trigger state-machine backstop (Decision 5) adds another place transition rules must be kept in sync with Edge Function logic → **Mitigation**: triggers only need the *terminal-state* rule (much smaller surface than the full graph), and they exist purely as a last line of defense, not the primary enforcement.
- **[Risk]** `pg_cron`/`pg_net` availability depends on the Supabase project tier/config, unverified in this workspace → **Mitigation**: flagged as an Open Question; fallback is an external cron (e.g. GitHub Actions scheduled workflow hitting the Edge Function URL with a service-role bearer token).
- **[Risk]** Stock reserved at order-creation but never released if `create-checkout` fails after decrementing but before returning a response → **Mitigation**: decrement and insert happen in the same Postgres transaction as the `orders`/`order_items` insert, so a failure rolls everything back atomically.
- **[Trade-off]** Money as integer pesos instead of cents end-to-end means every Wompi-facing code path needs an explicit ×100/÷100 — a missed conversion is a real failure mode → mitigated by centralizing the conversion in one `_shared/money.ts` helper used by every function that talks to Wompi.
- **[Risk]** Removing the NestJS checkout call is a breaking change for any other client of `${apiUrl}/orders/checkout` we're not aware of → **Mitigation**: out of scope to verify (per the Q&A, `brackend` itself is untouched); flagged as an Open Question for the user to confirm nothing else depends on that endpoint.

## Migration Plan

1. Ship migrations `0030`–`0034` (additive only — no existing table is altered), deploy, verify RLS with `openspec` review / manual `select`/`insert` as buyer and as anon.
2. Deploy Edge Functions (`create-checkout`, `wompi-webhook`, `get-payment-status`, `retry-payment`) to a **sandbox** Wompi environment first; set `WOMPI_ENVIRONMENT=SANDBOX` and sandbox secrets via `supabase secrets set`.
3. Register the sandbox webhook URL in the Wompi dashboard; run through the full resilience matrix (proposal §39) against sandbox before touching Angular.
4. Ship the Angular changes behind the existing route structure (`checkout.component.ts` rewritten, new `/checkout/result` and `/mis-compras` routes) — since `brackend`'s endpoint is simply stopped being called, this ships as one coordinated deploy, not a flag.
5. Add `expire-orders`/`reconcile-payments` scheduling once the core flow is verified.
6. Switch secrets/webhook URL to production Wompi credentials as a separate, explicit cutover step (proposal §43) — never bundled with a code deploy.
7. **Rollback**: since the old `brackend` endpoint is untouched, reverting the Angular checkout component to the previous commit restores the old flow immediately if the new one needs to be pulled; the new Supabase tables/functions are additive and safe to leave in place while rolled back.

## Open Questions

- Does this Supabase project have `pg_cron`/`pg_net` enabled? If not, `expire-orders`/`reconcile-payments` need an external scheduler.
- Is anything else besides this Angular app calling `brackend`'s `/orders/checkout` or `/orders/shipping-estimate`? Confirm before those become fully dead code.
- Should `retry-payment` create a new `payments` row or a new `payment_attempts` row under the same `payments` record? This design follows proposal §10/§31 (new `payment_attempts` row per attempt, one `payments` row per order-payment-intent) — confirm during task breakdown if a fresh `payments` row is preferred instead.

**Resolved during implementation:** shipping-rate data/formula — see Decision 4a (migrate `shipping_rates` into Supabase with a single shared `get_shipping_estimate` SQL function, user-confirmed).
