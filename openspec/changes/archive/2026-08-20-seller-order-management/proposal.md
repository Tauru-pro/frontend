## Why

Sellers currently have no way to see or act on orders containing their products — `orders`/`order_items`/`payments` (from `checkout-orders-wompi`) are readable only by the buyer who placed them and by admins. Once a buyer pays, the seller has no inbox, no way to mark an order as being prepared/shipped, and no visibility into what they need to fulfill. This change gives sellers a scoped, audited, non-financial view into their orders and a controlled operational workflow, without ever letting them touch payment truth.

## What Changes

- Add `order_items.seller_id` (snapshotted at order-creation time, same pattern as the already-snapshotted `product_name`/`unit_price`) so seller ownership of a line item never depends on a live join to `products` that could change later.
- **Architecture finding**: this marketplace's checkout already supports a single order containing products from multiple sellers (confirmed — `get_shipping_estimate` groups shipping cost by seller, and the cart has no single-seller constraint). So `orders.status` (payment-driven: `PENDING_PAYMENT`/`PAYMENT_PROCESSING`/`PAID`/`PAYMENT_FAILED`/`CANCELLED`/`EXPIRED`) cannot double as the seller's operational status — a new **per-(order, seller) fulfillment record** (`order_seller_fulfillments`) tracks each seller's own `PROCESSING`/`SHIPPED`/`COMPLETED`/`CANCELLED` progress on their portion of an order independently of any co-sellers in the same order.
- Add a `seller-orders` Edge Function (list/detail, read-only, RLS-backed) and a `seller-orders/:id/fulfillment` Edge Function (the only way to change fulfillment status — never a direct `supabase.from('order_seller_fulfillments').update(...)` from Angular) implementing the allowed transition graph (`PAID → PROCESSING → SHIPPED → COMPLETED`, plus `→ CANCELLED` with a required reason) as one atomic, conditional, audited update — same pattern as `checkout-orders-wompi`'s `apply_payment_approved`/`retry_payment` RPCs.
- Add `order_fulfillment_history` (mirrors `order_status_history`'s shape: `from_status`, `to_status`, `actor_type`, `actor_id`, `reason`, `created_at`) so every fulfillment change is attributable and auditable.
- Add RLS on `orders`/`order_items`/`payments`/`order_seller_fulfillments` granting sellers read access scoped to their own items only — a seller in a multi-seller order never sees another seller's line items, prices, or fulfillment state.
- Add a seller-facing "Órdenes" section (`seller/orders` list + `seller/orders/:id` detail) with filters (fulfillment status, payment status, date range, order number, buyer), pagination, summary counters, and a read-only payment/Wompi info panel (via a safe DTO — never the raw `payments` row, never `raw_response`).
- Realtime: sellers see new paid orders and fulfillment/payment changes without refreshing, via `postgres_changes` scoped by their own `seller_id`.
- **BREAKING** for RLS surface only: `order_items`/`payments`/`order_seller_fulfillments` gain new `select` policies (sellers) — no existing buyer/admin policy changes.

## Capabilities

### New Capabilities
- `seller-order-fulfillment`: seller-scoped order visibility (list, detail, filters, pagination, buyer/payment/product info read access), the per-seller fulfillment state machine and its audit trail, RLS enforcing seller ownership (including correct isolation in multi-seller orders), and Realtime updates for new/changed orders.

### Modified Capabilities
(none in `openspec/specs/` — `order-management` and `wompi-payment-integration`, the capabilities this change extends, only exist as delta specs inside the not-yet-archived `checkout-orders-wompi` change. This change's specs are written standalone under `seller-order-fulfillment` rather than as a delta against a non-existent main spec; `order_items.seller_id` is additive to the schema `checkout-orders-wompi` defines, not a change to any of its stated requirements.)

## Impact

- **Affected code**: `supabase/migrations/0041_*` onward (new columns/tables/RPCs), new `supabase/functions/seller-orders` and `supabase/functions/seller-orders-fulfillment` (or a combined function with sub-routes — see design.md), new `src/app/features/seller/orders/*` components, `src/app/features/seller/seller-routes.ts` (new routes), `src/app/core/services/seller-order.service.ts` (new), `src/app/app.routes.server.ts` (new `seller/orders/:id` SSR route).
- **Depends on**: `checkout-orders-wompi` (the `orders`/`order_items`/`payments`/`order_status_history` schema and RLS foundations) — this change's migrations continue that numbering sequence and assume that schema exists.
- **Not in scope**: refunds (explicitly deferred, same as `checkout-orders-wompi`'s non-goals), seller payouts/commissions, editing order contents/prices, changing the buyer's shipping address after payment, notification channels beyond in-app Realtime (no email/push).
