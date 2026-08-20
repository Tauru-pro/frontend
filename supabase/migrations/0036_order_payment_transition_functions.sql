-- Atomic payment/order state transitions (design.md Decision 4b). Each
-- function performs its `payments` update, its `orders` update, and (for
-- failure/expiry) the stock restore in a single PL/pgSQL function body — one
-- Postgres transaction per call — instead of separate supabase-js requests,
-- which are not transactional across tables. All three are service_role
-- only: Edge Functions call them via `.rpc(...)`, never raw table updates.
--
-- Each function returns true only if it actually applied a change (the
-- conditional `WHERE status IN (...)` guard is what makes repeated/
-- out-of-order webhook delivery a safe no-op — design.md Decision 5/§29).

create or replace function public.restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
  set stock_quantity = p.stock_quantity + oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id and oi.product_id = p.id;
end;
$$;

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
  end if;

  return v_updated;
end;
$$;

create or replace function public.apply_payment_failed(
  p_payment_id uuid,
  p_order_id uuid,
  p_status text,
  p_provider_transaction_id text,
  p_failure_reason text,
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
  if p_status not in ('DECLINED', 'ERROR', 'VOIDED') then
    raise exception 'INVALID_ARGUMENT: p_status must be DECLINED, ERROR or VOIDED (got %)', p_status;
  end if;

  perform set_config('app.status_change_source', 'WOMPI_WEBHOOK', true);
  perform set_config('app.status_change_reason', 'payment ' || lower(p_status), true);

  update public.payments
  set status = p_status,
      provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
      failure_reason = p_failure_reason,
      raw_response = coalesce(p_raw_response, raw_response)
  where id = p_payment_id and status in ('CREATED', 'PENDING');

  if found then
    v_updated := true;

    update public.orders
    set status = 'PAYMENT_FAILED'
    where id = p_order_id and status = 'PAYMENT_PROCESSING';

    perform public.restore_order_stock(p_order_id);
  end if;

  return v_updated;
end;
$$;

create or replace function public.expire_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean := false;
begin
  perform set_config('app.status_change_source', 'SCHEDULED_EXPIRATION', true);
  perform set_config('app.status_change_reason', 'expires_at reached without payment', true);

  update public.orders
  set status = 'EXPIRED'
  where id = p_order_id and status = 'PENDING_PAYMENT' and expires_at < now();

  if found then
    v_updated := true;
    perform public.restore_order_stock(p_order_id);
  end if;

  return v_updated;
end;
$$;

revoke all on function public.restore_order_stock(uuid) from public;
revoke all on function public.apply_payment_approved(uuid, uuid, text, jsonb) from public;
revoke all on function public.apply_payment_failed(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.expire_order(uuid) from public;

grant execute on function public.apply_payment_approved(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.apply_payment_failed(uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.expire_order(uuid) to service_role;
