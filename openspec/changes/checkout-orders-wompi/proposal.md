## Why

Today `POST {apiUrl}/orders/checkout` (a NestJS backend outside this repo) is the only thing standing between "confirm order" and `order.paymentUrl` — there's no persisted order/payment model in Supabase, no Wompi integration, and no way for a buyer to see past orders. The marketplace cannot process real payments or show purchase history until checkout, orders, and payments are modeled and reconciled against Wompi directly in Supabase, matching how every other domain (bulls, products, sellers, pickup points) already lives there with RLS.

## What Changes

- **BREAKING**: Replace the NestJS checkout call (`OrderService.checkoutFromCart` → `${apiUrl}/orders/checkout`) with a Supabase Edge Function (`create-checkout`) that validates the cart, prices items server-side, and persists the order.
- **BREAKING**: Replace `window.location.href = order.paymentUrl` with the Wompi Widget (`widget.js`), opened client-side using the `publicKey`/`reference`/`amountInCents`/`integritySignature` returned by `create-checkout`.
- Add Postgres tables: `orders`, `order_items`, `payments`, `payment_attempts`, `webhook_events`, `order_status_history`, all under RLS (`auth.uid() = orders.user_id` for buyer reads; writes restricted to `service_role`/Edge Functions).
- Add Edge Functions: `create-checkout`, `wompi-webhook`, `get-payment-status`, `retry-payment`, `expire-orders` (scheduled), `reconcile-payments` (scheduled).
- Implement the order/payment state machines described in the proposal (`PENDING_PAYMENT → PAYMENT_PROCESSING → PAID → PROCESSING → SHIPPED → COMPLETED`, plus `PAYMENT_FAILED`/`CANCELLED`/`EXPIRED`) with forward-only transitions and idempotent webhook handling.
- Move shipping-cost calculation (`OrderService.getShippingEstimate`, currently also hitting `apiUrl`) into `create-checkout`/a Supabase RPC, since the backend must own the definitive total.
- Add a buyer "Mis compras" dashboard (list + detail) reading `orders`/`payments` via RLS, live-updated with Supabase Realtime.
- Add checkout resilience: client-generated `idempotencyKey` reused across retries/tabs/refresh, `UNIQUE(user_id, idempotency_key)` on `orders`, and a `/checkout/result` page that only shows an informational "verifying payment" state (never marks an order paid client-side).

## Capabilities

### New Capabilities
- `order-management`: order/order-item persistence, price/discount/tax snapshotting, order status machine, expiration, order-status audit trail, buyer order history dashboard.
- `wompi-payment-integration`: payment/payment-attempt persistence, Wompi reference + integrity-signature generation, Wompi Widget checkout, webhook ingestion with checksum validation and idempotency, payment status machine, amount/reference/currency validation, retry-payment flow, reconciliation against the Wompi transactions API.

### Modified Capabilities
- `shopping-cart`: the "Buyer completes checkout" requirement changes from posting to the NestJS backend and redirecting to `order.paymentUrl`, to calling `create-checkout` with an idempotency key and opening the Wompi Widget; adds resume-on-refresh/duplicate-tab behavior backed by the new `orders` table instead of only `sessionStorage`.

## Impact

- **Affected code**: `checkout.component.ts`/`.html`, `core/services/order.service.ts` (rewritten against Supabase instead of `apiUrl`), `core/models/cart.model.ts` (new `OrderResponse` shape), `CartStore` (idempotency key lifecycle), new `core/services/payment.service.ts`, new `features/marketplace/checkout/result` and `features/marketplace/orders` (dashboard) routes, `app.routes.server.ts` (new `:id`-style order-detail route).
- **Affected infra**: `supabase/migrations/003x_*` (new tables/policies/functions), `supabase/functions/create-checkout`, `supabase/functions/wompi-webhook`, `supabase/functions/get-payment-status`, `supabase/functions/retry-payment`, `supabase/functions/expire-orders`, `supabase/functions/reconcile-payments`, new Supabase secrets (`WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_ENVIRONMENT`, `WOMPI_API_URL`).
- **Removed dependency**: the NestJS `brackend` `/orders/checkout` and `/orders/shipping-estimate` endpoints are no longer called by the frontend for this flow (that service is out of scope for this change and untouched).
- **Third-party**: adds the Wompi Widget script (`https://checkout.wompi.co/widget.js`) loaded client-side, and outbound calls from Supabase to the Wompi transactions API for reconciliation.
