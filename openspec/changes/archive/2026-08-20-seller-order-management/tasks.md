## 1. Database schema

- [x] 1.1 Write `supabase/migrations/0042_order_items_seller_id.sql`: add `order_items.seller_id uuid references seller_profiles(id)`, backfill any existing rows via `product_id → products.tenant_id` (defensive, in case any orders already exist from `checkout-orders-wompi` testing), add an index on `(seller_id)`, and add the seller-scoped RLS `select` policy (`seller_id = (select id from seller_profiles where user_id = auth.uid())`) — design Decision 1/4.
- [x] 1.2 Write `supabase/migrations/0043_order_seller_fulfillments_schema.sql`: create `order_seller_fulfillments` (id, order_id, seller_id, status check in `('RECEIVED','PROCESSING','SHIPPED','COMPLETED','CANCELLED')`, cancelled_reason, created_at, updated_at, `unique(order_id, seller_id)`), RLS `select` scoped to the owning seller (no insert/update/delete policy for any client role — design Decision 5), `set_updated_at` trigger, and `alter publication supabase_realtime add table order_seller_fulfillments;` (design Decision 6).
- [x] 1.3 Write `supabase/migrations/0044_order_fulfillment_history.sql`: create `order_fulfillment_history` (id, fulfillment_id, order_id, seller_id, from_status, to_status, actor_type check in `('SELLER','SYSTEM','ADMIN')`, actor_id, reason, created_at), RLS `select` scoped to the owning seller, no client write policy.
- [x] 1.4 Write `supabase/migrations/0045_extend_apply_payment_approved.sql`: `CREATE OR REPLACE FUNCTION apply_payment_approved` (extending the `checkout-orders-wompi` version from migration `0036`) to also insert one `order_seller_fulfillments` row per distinct `seller_id` in that order's `order_items` (status `RECEIVED`) inside the same transaction, guarded by the same conditional update that already makes the function idempotent (design Decision 3) — add a code comment marking this as a cross-change extension point per the design's Open Question.
- [ ] 1.5 Apply migrations and manually verify: a seller can `select` only their own `order_items`/`order_seller_fulfillments` rows; `insert`/`update`/`delete` on `order_seller_fulfillments` from an authenticated (non-service-role) client is rejected; `select` on `orders`/`payments` directly as a seller returns no rows.

## 2. Fulfillment transition + read RPCs

- [x] 2.1 Write `supabase/migrations/0046_seller_order_read_functions.sql`: `security definer` RPC `get_seller_orders(p_status text, p_payment_status text, p_date_from timestamptz, p_date_to timestamptz, p_search text, p_page int, p_page_size int)` returning `jsonb` — resolves the caller's `seller_profiles.id` from `auth.uid()`, filters/paginates server-side, and for each order returns only the caller's own item count/subtotal, never `orders.total` (design Decision 4).
- [x] 2.2 In the same migration, add `get_seller_order_detail(p_order_id uuid)` returning `jsonb` — order-level non-financial fields (id, created_at, buyer name/email/phone, pickup point name/address — explicitly no `buyer_address`, per design Decision 4/resolved Open Question), only the caller's own `order_items`, the caller's fulfillment row + history, and the safe payment DTO (status/method/provider_reference/provider_transaction_id/approved_at — no amount, no raw_response). Returns null/empty if the caller has no items on that order — never an error that would leak the order's existence.
- [x] 2.3 Write `supabase/migrations/0047_update_order_fulfillment_status_function.sql`: `security definer` RPC `update_order_fulfillment_status(p_order_id uuid, p_new_status text, p_reason text default null)` implementing the transition graph from design Decision 2/5 (conditional `WHERE status = <expected source>`, reject if no row matches, require `p_reason` for `CANCELLED`, insert into `order_fulfillment_history` with `actor_type = 'SELLER'`, `actor_id = auth.uid()`), returning a boolean (`false` on conflict, not an exception) so the Edge Function can map that to `409`.
- [x] 2.4 Grant `execute` on all three RPCs to `authenticated` only (no `anon`, no `public`).

## 3. Edge Functions

- [x] 3.1 Scaffold `supabase/functions/seller-orders/index.ts` (JWT required; anon key + forwarded `Authorization` header, same pattern as `create-checkout`, so `auth.uid()` resolves inside the RPCs). `GET`-style via POST body (matching this repo's established convention from `checkout-orders-wompi`): list mode when no `orderId` given (calls `get_seller_orders` with filter/pagination params from the body), detail mode when `orderId` given (calls `get_seller_order_detail`).
- [x] 3.2 Scaffold `supabase/functions/seller-orders-fulfillment/index.ts` (POST, JWT required, same auth pattern): calls `update_order_fulfillment_status`; maps `false` return to `409 Conflict`, validation failures to `400`, "no such fulfillment record for this seller" to `404`.
- [x] 3.3 Apply the same defensive logging pattern established in `checkout-orders-wompi` (log `error.code`/`details`/`hint`, wrap handlers in try/catch) to both functions from the start.
- [ ] 3.4 Deploy both and manually test: seller A cannot fetch seller B's order detail (empty response, not 403 — avoid leaking existence); a stale transition attempt returns 409; cancelling without a reason returns 400.

## 4. Frontend: models and services

- [x] 4.1 Add `core/models/seller-order.model.ts`: `SellerOrderSummary`, `SellerOrderDetail`, `SellerOrderItem`, `SellerPaymentSummary`, `FulfillmentStatus`, `FulfillmentHistoryEntry` — matching the RPCs' `jsonb` shapes (camelCase mapping, mirroring the `mapXRow` pattern used throughout `core/services/*.service.ts`).
- [x] 4.2 Add `core/services/seller-order.service.ts`: `getOrders(filters, page, pageSize)` and `getOrder(orderId)` via `supabase.functions.invoke('seller-orders', ...)`, `updateFulfillmentStatus(orderId, status, reason?)` via `supabase.functions.invoke('seller-orders-fulfillment', ...)`, and `watchFulfillments(onChange)` — a Realtime subscription on `order_seller_fulfillments` scoped to the current seller (mirrors `PaymentService.watchOrder` from `checkout-orders-wompi`).

## 5. Frontend: seller order list

- [x] 5.1 Add `features/seller/orders/orders-list.component.ts`: table/list of `SellerOrderSummary` (order #, date, buyer, seller's own total, payment status, fulfillment status, item count, last updated), using `DataTableComponent`/`TableCellDirective`/`TableEmptyDirective` (same pattern as `shipping-rates.component.ts`/`pickup-points` admin lists) for pagination.
- [x] 5.2 Add filter controls: fulfillment status, payment status, date range, order number/buyer search — all passed to `SellerOrderService.getOrders(...)`, never filtered client-side over an already-downloaded set.
- [x] 5.3 Add summary counter cards (Nuevas/Por preparar/En preparación/Enviadas/Completadas) computed from the same `get_seller_orders` results (or a lightweight count query) — never an independently-maintained counter (design/proposal §10).
- [x] 5.4 Wire `watchFulfillments` so a new `RECEIVED` row or a status change refreshes the list live.
- [x] 5.5 Map technical fulfillment/payment statuses to the Spanish labels from design Decision 7 (a `STATUS_LABELS`-style lookup, matching `orders-list.component.ts`'s existing pattern on the buyer side).

## 6. Frontend: seller order detail

- [x] 6.1 Add `features/seller/orders/order-detail.component.ts` at route `seller/orders/:id`: order info, buyer contact (name/email/phone — no address), pickup point, this seller's items with quantities/unit prices/subtotal (from the snapshot, never recalculated), financial summary (seller's own subtotal — not the order total), read-only payment section (status/method/reference/transaction id/approved date, no amount).
- [x] 6.2 Add the fulfillment action button(s): "Marcar como preparado" / "Marcar como enviado" / "Marcar como completado", each showing a confirmation dialog before calling `updateFulfillmentStatus` (proposal §19), and a "Cancelar orden" flow (only visible from `RECEIVED`/`PROCESSING`) that requires selecting/entering a reason before submitting (proposal §20).
- [x] 6.3 Handle the `409 Conflict` response: show a message and re-fetch the order detail rather than silently failing or retrying blindly (proposal §27).
- [x] 6.4 Add the fulfillment history timeline (from/to status, actor, reason, timestamp), distinguishing `SELLER`/`SYSTEM`/`ADMIN`/webhook-driven entries visually (proposal §21-22).
- [x] 6.5 Wire `watchFulfillments`/a per-order Realtime subscription so a status change (e.g. from another session) updates the view live.

## 7. Routing

- [x] 7.1 Add `seller/orders` and `seller/orders/:id` to `features/seller/seller-routes.ts` (guarded by the existing `sellerGuard`, same pattern as `products`/`branches`/`inventory`).
- [x] 7.2 Register `seller/orders/:id` in `app.routes.server.ts` with `RenderMode.Server` (dynamic-id convention already used for `seller/inventory/:itemId` etc.).
- [x] 7.3 Add a nav link/section for "Órdenes" in the seller backoffice sidebar (wherever `products`/`branches`/`inventory` links currently live).

## 8. End-to-end verification

- [ ] 8.1 Full flow: buyer completes checkout and payment is approved (reusing the `checkout-orders-wompi` sandbox flow) → confirm a `RECEIVED` fulfillment row appears for the correct seller(s), and appears live in the seller's order list without refresh.
- [ ] 8.2 Multi-seller order: construct a cart with products from two different sellers, complete checkout, confirm each seller only sees their own items/subtotal/fulfillment record in their respective sessions, and neither sees the other's data via list, detail, or a direct `supabase.from(...)` query in devtools.
- [ ] 8.3 Walk a single fulfillment through `RECEIVED → PROCESSING → SHIPPED → COMPLETED`, confirming each step requires confirmation, updates live in a second open session, and produces a correctly-attributed history entry.
- [ ] 8.4 Attempt an invalid transition (e.g. `RECEIVED → COMPLETED`) and confirm it's rejected; attempt a valid transition twice concurrently (two tabs) and confirm exactly one succeeds with the other getting a 409.
- [ ] 8.5 Cancel an order from `RECEIVED` with a reason; confirm it's rejected without one; confirm cancellation is unavailable once `SHIPPED`.
- [ ] 8.6 Confirm a `PENDING_PAYMENT`/`PAYMENT_FAILED` order never appears in any seller's order list.
- [ ] 8.7 Confirm direct client mutation attempts (`supabase.from('order_seller_fulfillments').update(...)` from the browser console) are rejected by RLS.
