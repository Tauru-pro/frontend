-- seller-dashboard-commissions-settlements, 3.2: extends apply_payment_approved
-- (0036, extended by 0045 for seller-order-fulfillment) with a further
-- additive block that creates one seller_earnings row per distinct seller in
-- the order, inside the same transaction as the orders.status -> 'PAID'
-- update and the order_seller_fulfillments insert (design.md Decision 5).
--
-- CROSS-CHANGE EXTENSION POINT (same as 0045's own note on this function):
-- this function is owned by wompi-payment-integration. A future edit there
-- must preserve both this block and 0045's block, or those two features
-- silently stop reacting to payment approval.
--
-- gross_amount is computed from order_items.subtotal per seller, never from
-- orders.total (design.md Decision 6 — orders.total is a whole-order figure
-- that can span multiple sellers). Missing segment/commission rule never
-- blocks this transaction (design.md Decision 7): such a seller's earning is
-- still created, flagged needs_commission_review, with commission_rate = 0
-- so gross_amount - commission_amount = seller_net_amount still holds.
-- Idempotent via unique (payment_id, seller_id) + on conflict do nothing,
-- mirroring 0045's on conflict (order_id, seller_id) do nothing.

create or replace function public.apply_payment_approved(
  p_payment_id uuid,
  p_order_id uuid,
  p_provider_transaction_id text,
  p_raw_response jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean := false;
  v_seller record;
  v_gross integer;
  v_rate numeric(5,2);
  v_commission integer;
begin
  perform set_config('app.status_change_source', 'WOMPI_WEBHOOK', true);
  perform set_config('app.status_change_reason', 'payment approved', true);

  update public.payments
  set status = 'APPROVED',
      provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
      raw_response = coalesce(p_raw_response, raw_response),
      approved_at = now()
  where id = p_payment_id and status in ('CREATED', 'PENDING');

  if found then
    v_updated := true;

    update public.orders
    set status = 'PAID', paid_at = now()
    where id = p_order_id and status = 'PAYMENT_PROCESSING';

    -- seller-order-management extension point: one RECEIVED fulfillment row
    -- per distinct seller in this order's items.
    insert into public.order_seller_fulfillments (order_id, seller_id, status)
    select distinct p_order_id, oi.seller_id, 'RECEIVED'
    from public.order_items oi
    where oi.order_id = p_order_id and oi.seller_id is not null
    on conflict (order_id, seller_id) do nothing;

    -- seller-dashboard-commissions-settlements extension point: one
    -- seller_earnings row per distinct seller in this order's items,
    -- commission frozen at whatever rate resolves right now.
    for v_seller in
      select oi.seller_id as id, sp.segment_id, sum(oi.subtotal) as gross_amount
      from public.order_items oi
      join public.seller_profiles sp on sp.id = oi.seller_id
      where oi.order_id = p_order_id and oi.seller_id is not null
      group by oi.seller_id, sp.segment_id
    loop
      v_gross := v_seller.gross_amount;
      v_rate := null;

      if v_seller.segment_id is not null then
        v_rate := public.get_current_commission_rate(v_seller.segment_id, now());
      end if;

      if v_rate is null then
        -- No segment assigned, or no active rule for it: never block payment
        -- approval (design.md Decision 7) — create a flagged, zero-commission
        -- earning instead, for an admin to resolve later.
        insert into public.seller_earnings (
          seller_id, order_id, payment_id, gross_amount,
          commission_rate, commission_amount, seller_net_amount,
          status, needs_commission_review
        )
        values (
          v_seller.id, p_order_id, p_payment_id, v_gross,
          0, 0, v_gross,
          'PENDING', true
        )
        on conflict (payment_id, seller_id) where reversal_of_earning_id is null do nothing;
      else
        v_commission := round(v_gross * v_rate / 100);

        insert into public.seller_earnings (
          seller_id, order_id, payment_id, gross_amount,
          commission_rate, commission_amount, seller_net_amount,
          status, needs_commission_review
        )
        values (
          v_seller.id, p_order_id, p_payment_id, v_gross,
          v_rate, v_commission, v_gross - v_commission,
          'AVAILABLE', false
        )
        on conflict (payment_id, seller_id) where reversal_of_earning_id is null do nothing;
      end if;
    end loop;
  end if;

  return v_updated;
end;
$$;

revoke all on function public.apply_payment_approved(uuid, uuid, text, jsonb) from public;
grant execute on function public.apply_payment_approved(uuid, uuid, text, jsonb) to service_role;
