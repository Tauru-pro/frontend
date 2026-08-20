-- seller-order-management, 1.4: extends apply_payment_approved (0036, owned
-- by checkout-orders-wompi) to also create one order_seller_fulfillments row
-- per distinct seller in the order's items, status 'RECEIVED', inside the
-- same transaction as orders.status -> 'PAID' (design.md Decision 3). No
-- fulfillment row exists until payment is genuinely approved, so there is
-- nothing for a seller's order list to show prematurely for a
-- PENDING_PAYMENT/PAYMENT_PROCESSING order.
--
-- CROSS-CHANGE EXTENSION POINT (design.md Open Question): this function is
-- owned by checkout-orders-wompi. A future edit to apply_payment_approved
-- there must preserve the block below (or the seller-order-management
-- feature silently stops creating fulfillment records on payment approval).
-- The insert is additive and guarded by the same `if found` idempotency
-- check as the rest of the function, so a repeated webhook is still a no-op.

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
  end if;

  return v_updated;
end;
$$;

revoke all on function public.apply_payment_approved(uuid, uuid, text, jsonb) from public;
grant execute on function public.apply_payment_approved(uuid, uuid, text, jsonb) to service_role;
