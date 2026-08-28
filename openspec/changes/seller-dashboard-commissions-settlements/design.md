## Context

Today, once a payment reaches `APPROVED` (`wompi-payment-integration`), the only downstream effect is `apply_payment_approved` flipping `orders.status` to `PAID` and creating `order_seller_fulfillments` rows (`seller-order-fulfillment`, added in migration `0045` as an additive extension block on that same function). There is no financial record of what the marketplace owes each seller. `seller_profiles` (from `seller-tenant-identity`) has no segment concept; `onboarding_survey_questions`/`seller_onboarding_responses` (`0011`) are free-form, `SUPER_ADMIN`-authored questions with no structural link to a segment — there is no reliable way to parse them into `DISTRIBUTOR`/`LABORATORY`/`LIVESTOCK_COMPANY` automatically.

The schema also has no refund concept: `payments.status` (`0032`) and `orders.status` (`0031`) check constraints stop at `DECLINED`/`VOIDED`/`ERROR`/`EXPIRED`/`CANCELLED` — nothing resembling `REFUNDED`. `order_items.seller_id` (`0042`) is already snapshotted at insert time, and orders are already confirmed multi-seller-capable (`seller-order-fulfillment`'s finding, still true here) — so earnings must be computed per (order, seller), never per whole order.

This design must not touch the existing checkout/payment state machine (`create_order_with_items`, `apply_payment_approved`'s existing blocks, `retry_payment`, the webhook dedupe in `webhook_events`) — it only appends new, additive behavior at the one extension point that already exists for this purpose.

## Goals / Non-Goals

**Goals:**
- Normalize seller segment onto `seller_profiles.segment_id` — nothing downstream ever re-queries survey answers.
- Time-versioned, admin-configurable commission rules with no gaps in coverage that matter and no overlapping active rules for the same segment.
- Freeze `commission_rate`/`commission_amount`/`seller_net_amount` onto each earning at creation time — later rule changes never alter historical earnings.
- Idempotent earning creation under duplicate/retried Wompi webhooks.
- Race-safe settlement claiming — no earning is ever included in two settlements.
- A single seller-scoped, server-side aggregation RPC backing the dashboard (no client-side `SUM()`/`COUNT()` over raw rows).
- Never allow a missing/unassigned segment or commission rule to block checkout, payment approval, or fulfillment.

**Non-Goals:**
- Automatic refund-driven earning reversal (no `REFUNDED` status exists in `payments`/`orders` yet — see Decision 8). This change ships the data model and a manual admin reversal action only.
- Actual payout/bank-transfer execution — a settlement's `PAID` status only records that an admin executed payment through some other channel (bank transfer, manual Wompi payout, etc.).
- Automatic segment inference from free-form survey answers (see Decision 1).
- Multi-currency commission math (marketplace is COP-only today, matching the rest of the schema).

## Decisions

### Decision 1 — Segment assignment is a deliberate admin action, not survey parsing
**Choice**: `seller_profiles.segment_id` is set by an `ADMIN`/`SUPER_ADMIN` action, made part of the existing seller verification workflow (`admin/sellers/:id` review screen, which already surfaces `seller_onboarding_responses` as context) rather than derived programmatically from the survey's free-form `answer jsonb`.
**Why**: `onboarding_survey_questions` questions are entirely `SUPER_ADMIN`-authored free text with `SINGLE_CHOICE`/`MULTI_CHOICE`/`TEXT`/`NUMBER` input types and no `segment` column or fixed option vocabulary. Auto-mapping an arbitrary free-text/option answer to one of three fixed segment codes would require a second configuration surface (question→segment mapping) that doesn't exist and that the proposal's own principle (§2/§10) explicitly warns against building — "survey → segment" logic embedded in a runtime code path. An admin reading the same answers once, at verification time, and picking a segment from a fixed list satisfies the letter of the requirement (segment is normalized and frozen onto the profile, never re-derived at order time) without inventing brittle NLP-adjacent mapping logic.
**Alternatives considered**: (a) a `question_id → segment_code` mapping table read once at onboarding approval — rejected for now as unnecessary complexity for a 3-value enum with no committed mapping rules from the business; can be added later without schema change if the mapping becomes fixed and mechanical. (b) Let the seller self-select their segment at onboarding time — rejected: segment drives commission, which must stay admin-controlled per the proposal (§30).

### Decision 2 — Verification gate requires a segment before a seller can transact
**Choice**: extend the existing `protect_seller_profile_status`-style enforcement (`0023`) so a seller cannot move from `PENDING` to `ACTIVE` unless `segment_id IS NOT NULL`. Since `enforce_product_publish_gate` (`0023`) already blocks a seller's products from reaching `ACTIVE`/publishable until `seller_profiles.status = 'ACTIVE'`, and checkout only accepts `ACTIVE` products, this closes the loop: no order can exist for a seller who lacks a segment.
**Why**: guarantees `get_current_commission_rate` almost always resolves a real rate for any seller capable of selling, without adding a blocking check inside the hot payment-approval path.
**Residual gap**: sellers who were already `ACTIVE` before this migration ships have `segment_id IS NULL` at cutover (existing rows aren't touched by the new gate, which only fires on the `PENDING → ACTIVE` transition). Decision 7 covers how earning creation behaves for that gap without ever blocking payment approval.

### Decision 3 — Commission rate stored as a 0–100 percentage, never a fraction
**Choice**: `seller_segment_commission_rules.commission_rate numeric(5,2)`, values like `25.00` meaning 25%. All application-layer math (`commission_amount = round(gross_amount * commission_rate / 100)`) divides by 100 explicitly at the point of use; nothing stores or transmits a `0.25`-style fraction.
**Why**: matches proposal §7's explicit convention requirement and avoids a silent fraction/percentage mismatch across SQL, Edge Functions, and Angular — a single, auditable convention end to end.

### Decision 4 — Non-overlapping commission rules via a database exclusion constraint
**Choice**: enable `btree_gist` and add
```sql
alter table seller_segment_commission_rules
  add constraint no_overlapping_active_rules
  exclude using gist (
    segment_id with =,
    tstzrange(effective_from, coalesce(effective_until, 'infinity'), '[)') with &&
  ) where (active);
```
`get_current_commission_rate(p_segment_id, p_at timestamptz default now())` selects the single `active` rule whose range contains `p_at`.
**Why**: proposal §8 explicitly requires preventing overlapping active rules "at the constraint level," not just at the application layer — a database exclusion constraint is the only mechanism that holds under concurrent admin edits, matching this codebase's existing preference for database-enforced invariants (`UNIQUE(user_id, idempotency_key)`, `guard_order_status_transition`, `webhook_events`' partial unique indexes) over app-level checks alone.
**Alternatives considered**: application-level "check for overlap, then insert" — rejected, same TOCTOU race the codebase already guards against elsewhere (`create_order_with_items`'s comment on the `PRODUCT` row-lock race).

### Decision 5 — Earning creation lives inside `apply_payment_approved`, as a further additive block
**Choice**: extend `apply_payment_approved` again — a third additive block after the `orders.status → PAID` update and the `seller-order-fulfillment` `order_seller_fulfillments` insert — that groups the order's `order_items` by `seller_id`, computes each seller's `gross_amount = sum(subtotal)`, resolves `get_current_commission_rate(seller.segment_id, now())`, and inserts one `seller_earnings` row per seller. Guarded by the same `if v_updated` idempotency check the function already uses (an already-`APPROVED` payment short-circuits before reaching any block).
**Why**: this is the exact "CROSS-CHANGE EXTENSION POINT" pattern `0045` already established and documented for this same function, for this same reason (a payment-approval side effect that a later change needs to add without touching checkout/webhook code). Reusing it keeps every payment-approval side effect (order status, fulfillment records, now earnings) in one atomic transaction, so there is never a window where an order is `PAID` but earnings haven't been computed yet.
**Idempotency**: `unique (payment_id, seller_id)` on `seller_earnings`, plus `on conflict (payment_id, seller_id) do nothing` on the insert — mirrors `order_seller_fulfillments`' `on conflict (order_id, seller_id) do nothing` in the very same function.

### Decision 6 — `gross_amount` is computed from `order_items`, never from `orders.total`
**Choice**: `seller_earnings.gross_amount` is always `sum(order_items.subtotal) where order_items.seller_id = <this seller> and order_id = <this order>` — the same seller-scoped aggregation `get_seller_orders`/`get_seller_order_detail` (`0046`) already use for `sellerSubtotal`.
**Why**: `orders.total` is a whole-order figure that can span multiple sellers (confirmed multi-seller-per-order reality, `seller-order-fulfillment`). Using it directly would double-count or misattribute gross sales in any multi-seller order. This mirrors `0046`'s established pattern exactly rather than inventing a second computation.

### Decision 7 — Missing segment/commission rule never blocks payment approval
**Choice**: if `get_current_commission_rate` returns no row for a seller (`segment_id IS NULL`, or a segment with no active rule covering `now()`), the earning is still created — with `commission_rate = 0`, `commission_amount = 0`, `seller_net_amount = gross_amount`, `status = 'PENDING'`, and `needs_commission_review = true`. A `PENDING`+`needs_commission_review` earning never auto-advances to `AVAILABLE`. A dedicated admin RPC, `resolve_earning_commission(earning_id, commission_rate)`, lets an admin backfill the correct rate once the seller's segment/rule is fixed, which recomputes `commission_amount`/`seller_net_amount`, clears the flag, and moves the row to `AVAILABLE`.
**Why**: the instructions are explicit and non-negotiable — "No modificar el flujo actual de checkout/Wompi de manera que se rompa su comportamiento existente." Raising an exception inside `apply_payment_approved` for a data-completeness problem (an admin hasn't assigned a segment yet, or forgot to configure a rule) would make a real, checksum-valid, amount-matched Wompi approval fail to update `orders.status → PAID`, which is unacceptable. Money is never silently misattributed either: a `0`-rate, review-flagged earning is visibly wrong and easy to query (`where needs_commission_review`), rather than silently wrong.
**Covers the Decision 2 residual gap**: pre-cutover `ACTIVE` sellers with `segment_id IS NULL` simply accumulate `needs_commission_review` earnings until an admin assigns them a segment — checkout is never affected.

### Decision 8 — Reversal is a compensating entry, and refunds are explicitly out of scope for automatic triggering
**Choice**: `seller_earnings` rows are never updated in place to change `commission_amount`/`seller_net_amount`/`gross_amount`, and never deleted. `reverse_seller_earning(earning_id, reason)` (admin-only, `SECURITY DEFINER`) sets the target row's `status = 'REVERSED'` and inserts a second row with negated `gross_amount`/`commission_amount`/`seller_net_amount`, `status = 'AVAILABLE'` (so it nets off automatically in the seller's next settlement, per proposal §29), referencing the original via `reversal_of_earning_id`. This function can be called regardless of whether the original earning is `AVAILABLE`, `IN_SETTLEMENT`, or already `SETTLED` (proposal §29's "refund after settlement" case) — reversing a `SETTLED` earning never edits the historical settlement it was part of; the negative entry simply becomes eligible for the seller's next settlement.
**Why**: there is currently no `REFUNDED` payment/order status anywhere in the schema, and adding one — plus wiring a Wompi refund-webhook or refund-API integration — is a materially separate, currently-unscoped feature (Wompi's refund API, a new webhook event type, new order/payment states, updated state-machine guards in `guard_order_status_transition`/`guard_payment_status_transition`). Shipping the reversal *data model and admin action* now, without the automatic trigger, satisfies the "must have a defined, auditable way to handle this" requirement (§28/§29/US-22) without silently expanding this change into a second one.
**Alternatives considered**: deleting/editing the original earning — explicitly rejected by proposal §28 ("no eliminar earnings históricos").

### Decision 9 — Settlement claiming: conditional update, not advisory locks
**Choice**: `create_settlement(p_seller_id, p_earning_ids uuid[])` runs as one transaction:
```sql
update seller_earnings set status = 'IN_SETTLEMENT'
where id = any(p_earning_ids) and seller_id = p_seller_id and status = 'AVAILABLE'
returning id;
```
If the returned row count is less than `array_length(p_earning_ids, 1)`, the whole transaction rolls back (`raise exception 'EARNING_ALREADY_CLAIMED'`) rather than silently settling a partial set — the admin must re-fetch the seller's current `AVAILABLE` earnings and retry.
**Why**: this is the same "conditional UPDATE with a WHERE-clause status guard, check `if found`" pattern already used throughout this schema (`apply_payment_approved`'s `where id = p_payment_id and status in ('CREATED','PENDING')`, `update_order_fulfillment_status`). Two concurrent `create_settlement` calls both racing to claim earning `#100`: only one `UPDATE ... WHERE status = 'AVAILABLE'` actually matches that row; the second either matches 0 rows for it (if it lists exactly that id) and its overall returned-count check fails, so it rolls back entirely and reports the conflict rather than proceeding degraded. This resolves the exact race condition proposal §27 describes (Admin A / Admin B both settling earning `#100`).
**Alternatives considered**: `FOR UPDATE SKIP LOCKED` — better suited to a queue-consumption pattern (workers grabbing arbitrary available work); here the admin explicitly selects which earnings go into a settlement, so a hard conflict-and-retry is the correct UX (the admin needs to know their selection changed), not silent skipping.

### Decision 10 — RLS: sellers get direct `SELECT` on their own `seller_earnings`/`settlements`/`settlement_items`, unlike the whole-`orders`-row case
**Choice**: unlike `orders`/`payments` (where `seller-order-fulfillment` deliberately avoided direct seller RLS `SELECT` because a matching row would expose whole-order, potentially multi-seller totals — `0046`'s Decision 4), `seller_earnings` rows are already fully seller-scoped by construction: one row = one seller's own gross/commission/net for one payment. Direct RLS policies (`seller_id = (select id from seller_profiles where user_id = auth.uid())`) are sufficient and match the `order_seller_fulfillments`/`order_items` `seller_id`-scoped policies (`0042`/`0043`) rather than needing a security-definer RPC just to read.
**Why**: simpler, and consistent with the existing precedent of `order_seller_fulfillments` using plain RLS once ownership is a simple column match. The dashboard *aggregation* (sums across many rows, date-filtered) still goes through a `SECURITY DEFINER` RPC (`get_seller_dashboard_summary`) per proposal §32/§33 — RLS handles row-level access, the RPC handles the aggregate math so it isn't repeated client-side.
**Writes**: no `INSERT`/`UPDATE`/`DELETE` policy exists for any client role on `seller_earnings`, `settlements`, or `settlement_items` — same "RLS enabled, no matching write policy = hard rejection regardless of client attempt" pattern as `order_seller_fulfillments` (`0043`). All writes happen through `SECURITY DEFINER` functions granted only to `service_role`/called via Edge Functions authenticated as `ADMIN`/`SUPER_ADMIN`.

### Decision 11 — One generic financial audit log, not one table per concern
**Choice**: a single `financial_audit_log` table (`actor_id`, `actor_type`, `entity_type` — `'SEGMENT'|'COMMISSION_RULE'|'SELLER_SEGMENT'|'EARNING'|'SETTLEMENT'`, `entity_id`, `action`, `previous_value jsonb`, `new_value jsonb`, `reason`, `created_at`) captures every audited event from proposal §37 (segment changes, commission changes, earning creation/reversal, settlement creation/processing/cancellation).
**Why**: proposal §37 lists seven distinct auditable event kinds with an identical shape (`actor_id`, `actor_type`, `timestamp`, `previous_value`, `new_value`, `reason`) — one generic table with an `entity_type` discriminant avoids seven near-identical tables and lets an admin audit screen query "all financial changes for seller X" in one place instead of seven joins.
**Alternatives considered**: per-entity audit tables mirroring each domain table — rejected as unnecessary duplication for a write-once, append-only log with no per-entity-type querying requirement beyond filtering.

### Decision 12 — Dashboard: one `SECURITY DEFINER` RPC, Angular renders, no client-side aggregation
**Choice**: `get_seller_dashboard_summary(p_date_from timestamptz, p_date_to timestamptz)` resolves the caller's `seller_profiles.id` from `auth.uid()` (same pattern as `get_seller_orders`), never accepts a client-supplied seller id, and returns one JSON object: `gross_sales`, `orders_count`, `doses_sold`, `average_order_value`, `total_collected`, `platform_commission`, `seller_net`, `pending_settlement`, `settled_amount`. Angular's `SellerDashboardService` calls it via `supabase.rpc(...)`, matching the existing `SellerOrderService`/edge-function-invoke pattern already in the codebase.
**Why**: proposal §32/§33 explicitly forbid downloading raw rows and summing in Angular. A single RPC also means the "por liquidar" calculation (`AVAILABLE`-status earnings minus... — see below) and "liquidado" (`sum` of `SETTLED` earnings) share one consistent point of truth instead of being recomputed slightly differently in two UI components.
**`pending_settlement` definition** (resolves proposal §23's own caution against "a simplified subtraction of orders"): `sum(seller_net_amount) where seller_id = caller and status in ('AVAILABLE', 'IN_SETTLEMENT')` — i.e., earned-but-not-yet-`SETTLED`, computed directly from `seller_earnings.status`, never derived by subtracting two independently-rounded totals.
**`doses_sold`**: `sum(order_items.quantity)` scoped to `seller_id = caller` and joined through `seller_earnings` (i.e., only quantities belonging to an order/seller pair that produced a real earning — payment genuinely approved), which is how `CANCELLED`/never-approved orders are excluded per proposal §19 (an order that never reaches `PAID` never produces a `seller_earnings` row, so its items are structurally excluded without a separate status check).

### Decision 13 — Where new writes need an Edge Function vs. a plain RLS-guarded table
**Choice**: admin CRUD on `seller_segments` and `seller_segment_commission_rules` uses plain Supabase client calls under RLS (`ADMIN`/`SUPER_ADMIN`-only write policies), matching `ShippingRateService`'s existing direct-`supabase.from(...)` pattern — no Edge Function needed, since these are simple, non-financial-transaction CRUD with no cross-row invariant beyond what the exclusion constraint (Decision 4) already enforces at the database level. `create_settlement`/`mark_settlement_paid`/`reverse_seller_earning`/`resolve_earning_commission` are `SECURITY DEFINER` SQL functions called via `supabase.rpc(...)` (no separate Edge Function process needed — unlike `wompi-webhook`, there's no external caller or secret to protect here, just a caller-identity + transactional-integrity requirement, which an RPC satisfies directly, same as `create_order_with_items`/`update_order_fulfillment_status`).
**Why**: matches the codebase's existing split — Edge Functions where a secret must be protected or an external party (Wompi) is the caller; `SECURITY DEFINER` RPCs called directly from Angular where the only requirement is "run as an elevated, transactionally-safe operation but attribute it to the calling admin/seller."

## Risks / Trade-offs

- **[Risk] Pre-cutover `ACTIVE` sellers have no segment, producing a wave of `needs_commission_review` earnings the moment this ships** → Mitigation: ship a data migration listing every `seller_profiles` row with `status = 'ACTIVE' and segment_id is null` as a required manual admin follow-up (surfaced in the new Seller Segments admin screen as an "unassigned sellers" filter), and Decision 7 guarantees no payment ever fails to process because of it.
- **[Risk] Backfilling `seller_earnings` for orders already `PAID` before this change ships has no true historical commission rate** (none was ever recorded) → Mitigation: the one-time backfill migration applies the rate active *at backfill time* (or `0`/flagged if none), and every backfilled row is marked `backfilled = true` so it's distinguishable from a rate genuinely frozen at real approval time — documented as an accepted approximation, not silently indistinguishable history.
- **[Risk] Exclusion constraint (Decision 4) requires the `btree_gist` extension, not yet enabled in this project** → Mitigation: `create extension if not exists btree_gist;` is a normal, low-risk Supabase migration statement (Postgres core contrib extension, no new external dependency).
- **[Risk] A settlement admin screen that lets an admin select an unbounded number of earnings could construct a very large `p_earning_ids` array** → Mitigation: paginate the "available earnings for this seller" picker server-side; no hard limit is enforced at the database layer beyond normal statement/array size limits, which is acceptable for expected marketplace volume.
- **[Trade-off] Reversal nets off in a *future* settlement rather than adjusting the settlement it would conceptually belong to** → Accepted per Decision 8/proposal §29 ("no eliminar ni modificar retroactivamente la liquidación histórica") — this is the deliberate, spec-mandated behavior, not an oversight.

## Migration Plan

Continuing the existing sequential migration numbering from `0047`:

1. `0048_seller_segments_schema.sql` — `seller_segments` table + seed rows (`DISTRIBUTOR`, `LABORATORY`, `LIVESTOCK_COMPANY`) + RLS (read: authenticated; write: `SUPER_ADMIN`).
2. `0049_seller_profiles_segment.sql` — `seller_profiles.segment_id` FK (nullable), extends `protect_seller_profile_status`-style trigger to (a) block `SELLER` self-writes to `segment_id`, (b) require `segment_id is not null` on any `PENDING → ACTIVE` transition.
3. `0050_seller_segment_commission_rules_schema.sql` — table, `btree_gist` extension, exclusion constraint, seed initial rules (`DISTRIBUTOR 25%`, `LABORATORY 25%`, `LIVESTOCK_COMPANY 30%`, `effective_from = now()`), `get_current_commission_rate()` function, RLS (read: authenticated; write: `SUPER_ADMIN`).
4. `0051_seller_earnings_schema.sql` — `seller_earnings` table, states, `unique (payment_id, seller_id)`, RLS (seller reads own, admin reads all, no client writes).
5. `0052_extend_apply_payment_approved_earnings.sql` — the additive earning-creation block inside `apply_payment_approved` (Decision 5/7).
6. `0053_seller_earnings_backfill.sql` — one-time backfill for pre-existing `PAID` orders (Risk above), each row flagged `backfilled = true`.
7. `0054_settlements_schema.sql` — `settlements` + `settlement_items`, `create_settlement`/`mark_settlement_paid`/`cancel_settlement` functions, RLS (seller reads own, admin reads/writes).
8. `0055_reverse_and_resolve_earning_functions.sql` — `reverse_seller_earning`, `resolve_earning_commission`.
9. `0056_financial_audit_log_schema.sql` — `financial_audit_log` table + triggers/inserts wired into every function from steps 2–8 that mutates a segment, rule, earning, or settlement.
10. `0057_seller_dashboard_summary_function.sql` — `get_seller_dashboard_summary()`.
11. Realtime: `alter publication supabase_realtime add table public.seller_earnings, public.settlements;` (own migration or folded into step 10), scoped by the same RLS already in place.

**Rollback**: every migration is additive (new tables/columns/functions); rollback is `drop` in reverse order. The one meaningfully destructive step is the `0052` extension to `apply_payment_approved` — rolling it back means `create or replace function` back to the `0045` version, which is safe since no other function depends on the new block.

## Open Questions

- Should the "unassigned sellers" backlog (Risk 1) block *new* seller self-onboarding entirely until a segment is assigned, or continue letting sellers reach `PENDING` and simply wait longer for `ACTIVE`? This design assumes the latter (no change to `submit_seller_onboarding`) since onboarding is out of this change's stated scope — confirm with the business before `0049` ships if a stricter gate is wanted.
- Should `resolve_earning_commission` be able to re-run in bulk (all `needs_commission_review` rows for a seller at once) rather than one earning at a time? Deferred to tasks/implementation — the RPC signature in Decision 7 covers the single-row case; a bulk variant can be added without a schema change if the manual backlog turns out to be large in practice.
