## Context

`checkout-orders-wompi` (in progress, migrations `0030`-`0040`) established `orders`, `order_items`, `payments`, `payment_attempts`, `order_status_history`, all RLS-scoped so only the buyer (`auth.uid() = orders.user_id`) and admins can read them. There is no seller access at all today. This change adds it.

**Architecture finding that shapes everything below**: this marketplace's checkout does *not* guarantee one order = one seller. `create_order_with_items` (0037) accepts an arbitrary cart, and `get_shipping_estimate` (0030) already groups shipping cost per distinct seller found in the cart — meaning a single order's `order_items` can legitimately belong to different `seller_profiles`. Nothing in the schema prevents this, and the checkout UI never restricts a cart to one seller. So:
- Ownership of a *line item* is per-item (`order_items` → `products.tenant_id`), not per-order.
- A seller-visible "operational status" cannot live on `orders.status` (one column, one value) without either (a) letting one seller's action silently affect another seller's unrelated items in the same order, or (b) blocking multi-seller orders retroactively (not this change's call to make — that's a product decision, not an engineering one, and the existing shipping-estimate logic clearly anticipated multi-seller carts as a real case).
- Any order-level financial figure (`orders.total`/`subtotal`/`shipping_cost`, `payments.amount`) reflects the *whole* order, not one seller's share — showing it to a single seller in a multi-seller order leaks the other seller(s)' revenue.

Every decision below exists to handle that finding correctly rather than assume the simpler single-seller case.

## Goals / Non-Goals

**Goals:**
- Sellers can see and manage only the order items that are theirs, even inside an order shared with other sellers.
- A seller's fulfillment progress (`PROCESSING`/`SHIPPED`/`COMPLETED`/`CANCELLED`) is tracked independently of any co-seller's progress on the same order.
- Sellers never get read access to another seller's revenue figures, and never get write access to anything payment-related.
- Fulfillment transitions are atomic, validated server-side, and audited — mirroring the RPC pattern `checkout-orders-wompi` already established for payment transitions.
- Sellers see new paid orders and status changes live, without a refresh.

**Non-Goals (this change):**
- Refunds (same deferral as `checkout-orders-wompi`).
- Any change to how an order's *payment* is created, validated, or transitioned — this change only adds a fulfillment layer on top of an already-PAID order.
- Editing order contents, prices, or the buyer's shipping details after the fact.
- Cross-seller coordination UI (e.g. a combined "this order has 2 sellers" banner) — out of scope for v1; each seller's view is self-contained.
- Email/push notifications — Realtime + in-app UI only.

## Decisions

### 1. `order_items.seller_id` — snapshotted, not derived live
Add `seller_id uuid references seller_profiles(id)` to `order_items`, populated at insert time (extending `create_order_with_items`'s existing per-line insert, which already snapshots `product_name`/`unit_price` — this is the same pattern, not a new one). Ownership checks use this column directly, never `order_items.product_id → products.tenant_id`, so a hypothetical future product-reassignment or deletion can never change who owns a historical order item.

**Alternative considered**: derive ownership via a join to `products` on every query. Rejected — matches none of the existing snapshot conventions in this schema, is slower for RLS (a join inside every policy check), and is fragile if `products` rows are ever deleted (order history would become unqueryable for ownership purposes).

### 2. Per-(order, seller) fulfillment, not per-order-item and not on `orders.status`
New table `order_seller_fulfillments` (id, order_id, seller_id, status, cancelled_reason, created_at, updated_at) — **one row per distinct seller present in an order**, not one row per line item (a seller's items in one order ship together as one parcel; tracking per-item would force the seller to update N rows for one shipment). `orders.status` remains exactly what `checkout-orders-wompi` defined — the payment-driven, buyer-facing aggregate — and this change never writes to it.

Status values: `RECEIVED` (row just created, order is PAID, seller hasn't acted yet — this is "new order" / "por preparar" from proposal §6/§10) → `PROCESSING` → `SHIPPED` → `COMPLETED`; `CANCELLED` reachable from `RECEIVED` or `PROCESSING` only (with a required `cancelled_reason`), never from `SHIPPED`/`COMPLETED`. This matches proposal §16-18's state machine, with `RECEIVED` added as the explicit "paid, not yet started" state so the dashboard counters (§10) have something to count as "Nuevas" without conflating it with `PROCESSING`.

**Alternative considered**: a `fulfillment_status` column directly on `order_items`. Rejected per the "ships as one parcel" reasoning above, and because it would require an aggregate-of-N-rows to answer "what's this seller's status on this order" instead of one row.

### 3. Fulfillment rows are created exactly when the order becomes PAID — inside the same atomic transition, not by a separate step
`apply_payment_approved` (`0036`, from `checkout-orders-wompi`) is extended (`CREATE OR REPLACE`, new migration in this change) to also insert one `order_seller_fulfillments` row (`status = 'RECEIVED'`) per distinct `seller_id` found in that order's `order_items`, in the same transaction as the `orders.status = 'PAID'` update. This is what makes proposal §31 ("a PENDING_PAYMENT order must never look like a new order to prepare") true *structurally* — no fulfillment row exists at all until payment is genuinely approved, so there's nothing for the seller inbox to show prematurely, and no separate filtering logic needs to get this right. It also gives proposal §30's "no duplicate notifications from duplicate webhooks" for free: `apply_payment_approved`'s existing conditional `WHERE status IN ('CREATED','PENDING')` (Decision 5 in `checkout-orders-wompi`) already makes the whole transition — including this new insert — a no-op on a repeated webhook.

### 4. Sellers never get RLS `select` on `orders` or `payments` directly — all seller reads go through two security-definer RPCs
This is the direct fix for the multi-seller revenue-leak problem identified in Context. Two `jsonb`-returning RPCs, both resolving the caller's `seller_profiles.id` from `auth.uid()` (never a client-supplied seller id, same pattern as `create_order_with_items`):

- **`get_seller_orders(p_status, p_payment_status, p_date_from, p_date_to, p_search, p_page, p_page_size)`** — paginated list. Each row is one *seller-scoped* order summary: order id, created_at, buyer name, this seller's own item count and **this seller's own subtotal** (`sum(order_items.subtotal) where seller_id = caller`, never `orders.total`), payment status (safe subset), fulfillment status. Filtering/pagination happen inside the function (proposal §7/§8 — never download-everything-and-filter-in-Angular).
- **`get_seller_order_detail(p_order_id)`** — full detail for one order: order-level non-financial fields (id, created_at, buyer name/email/phone, pickup point name/address), *only this seller's* `order_items` rows, this seller's fulfillment row + its history, and a safe payment DTO (`status`, `payment_method`, `provider_reference`, `provider_transaction_id`, `approved_at` — explicitly never `amount`, never `raw_response`, never any Wompi secret). Returns nothing (empty/null, not an error that leaks existence) if the caller has no items on that order. **User-confirmed**: `orders.buyer_address` is intentionally excluded — this marketplace's checkout is pickup-point based (not door-to-door delivery), so the pickup point is what's operationally relevant; the buyer's personal address isn't needed by the seller and stays out of the DTO to minimize exposure of the buyer's personal data.

`order_items` still gets a narrow seller-scoped RLS `select` policy (`seller_id = caller's seller_profiles.id`) — safe on its own (row-level, no cross-seller data in a single row) and lets Realtime subscribe to it directly (Decision 6) without needing the RPCs to be realtime-aware.

**Alternative considered**: grant sellers a `select` policy on `orders` filtered by `exists (select 1 from order_items where order_id = orders.id and seller_id = caller)`, and a similar one on `payments`. Rejected — a matching row makes the *entire* `orders`/`payments` row readable, including `total`/`subtotal`/`amount`, which are whole-order figures a co-seller has no right to see. RLS is row-level, not column-level; a view could hide columns, but two purpose-built RPCs are simpler to reason about, match the pagination/filtering requirement (§7/§8) more directly than a view, and follow the same architectural pattern already established (`create_order_with_items`, `retry_payment`).

### 5. Fulfillment transitions: one atomic, conditional RPC, called only through an Edge Function — never a direct client `update`
`update_order_fulfillment_status(p_order_id, p_new_status, p_reason default null)` — `security definer`, resolves caller's `seller_profiles.id` from `auth.uid()`, verifies a `order_seller_fulfillments` row exists for `(p_order_id, that seller_id)`, validates the transition against the fixed graph from Decision 2 (`WHERE status = <required current status>`, same conditional-update-affects-zero-rows-means-conflict pattern as `checkout-orders-wompi`'s payment RPCs), requires `p_reason` when `p_new_status = 'CANCELLED'`, and inserts into `order_fulfillment_history` (`from_status`, `to_status`, `actor_type = 'SELLER'`, `actor_id = auth.uid()`, `reason`, `created_at`) in the same transaction. Returns `false` (not an exception) on a stale/conflicting transition, so the Edge Function can map that to `409 Conflict` (proposal §27) and the frontend re-fetches via `get_seller_order_detail`.

The Edge Function (`seller-orders-fulfillment`, POST, JWT required, anon key + forwarded `Authorization` so `auth.uid()` resolves correctly — same pattern as `create-checkout`/`retry-payment`) is the *only* path to this RPC from the client; `order_seller_fulfillments` has **no** client-facing `update`/`insert`/`delete` RLS policy at all (only the seller-scoped `select` from Decision 4/6), so `supabase.from('order_seller_fulfillments').update(...)` from Angular is rejected by RLS even if someone tried it directly — defense in depth beyond just "the UI doesn't expose a button for it" (proposal §28).

### 6. Realtime scoped to `order_seller_fulfillments`, not to `orders`/`payments`
Sellers subscribe to `postgres_changes` on `order_seller_fulfillments` filtered by their own `seller_id` (RLS already scopes this correctly per Decision 4). A new `INSERT` (order just became payable/fulfillable) or an `UPDATE` (status changed — including one from the buyer-side flow retrying/expiring, if that ever indirectly affects fulfillment) triggers the frontend to re-fetch the affected order via `get_seller_order_detail` or refresh the list via `get_seller_orders`. This sidesteps needing any Realtime-enabling RLS on `orders`/`payments` for sellers at all, consistent with Decision 4.

### 7. Friendly status labels stay entirely in the frontend
Per proposal §36, the seller UI maps technical statuses (`RECEIVED`/`PROCESSING`/`SHIPPED`/`COMPLETED`/`CANCELLED` for fulfillment; `PAID`/`PAYMENT_FAILED`/etc. surfaced read-only for payment context) to Spanish labels the same way `orders-list.component.ts`/`order-detail.component.ts` already do for the buyer side (`STATUS_LABELS` lookup objects) — no new backend concept, pure presentation.

## Risks / Trade-offs

- **[Risk]** Two new security-definer RPCs (`get_seller_orders`/`get_seller_order_detail`) duplicate some shaping logic that a view-based approach might have expressed more declaratively → **Mitigation**: accepted trade-off for the column-level privacy guarantee (Decision 4) that a view/RLS-only approach can't give as cleanly; both RPCs are read-only and narrow in scope.
- **[Risk]** Extending `apply_payment_approved` (owned by `checkout-orders-wompi`) from a dependent change creates a cross-change coupling — a future edit to that function in `checkout-orders-wompi` could silently drop the fulfillment-row insert if done carelessly → **Mitigation**: document the dependency prominently in both changes' `design.md`; the fulfillment insert is additive and self-contained (a single `INSERT ... SELECT DISTINCT seller_id FROM order_items WHERE order_id = ...`), low risk of accidental removal, but flagged as an Open Question for whether `checkout-orders-wompi` should own a documented "extension point" instead.
- **[Trade-off]** A seller's "total" for an order is their own items' subtotal, not including any share of shared shipping cost (which is computed and charged per-seller already at checkout time per `get_shipping_estimate`, so this is actually consistent — just calling it out since it's a figure that doesn't appear anywhere in `checkout-orders-wompi`'s existing model and is computed fresh here).
- **[Risk]** `order_seller_fulfillments` rows are created for *every* distinct seller in an order the moment it's paid, including a seller whose single line item is a $0 or negligible line — no minimum-order-value gate. Not treated as a problem for v1 (matches "every seller with real items gets a real fulfillment record" — simplest correct behavior), but flagged in case a future minimum-order-per-seller rule needs one.

## Open Questions

- Should `checkout-orders-wompi`'s `apply_payment_approved` formally document an "extension point" (e.g. a comment marking exactly where dependent changes should hook in) now that a second change modifies it? Recommend yes, as a small follow-up, not blocking this change.

**Resolved during proposal:** whether the seller-facing DTO includes `orders.buyer_address` — user confirmed no; pickup point only (see Decision 4).
