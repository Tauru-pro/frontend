-- Atomic retry-payment (same rationale as 0036/0037): a new payment_attempts
-- row + resetting payments.status + moving orders back to
-- PAYMENT_PROCESSING happen in one transaction. Reads auth.uid() directly so
-- a buyer can only retry their own order. Only orders already
-- PAYMENT_FAILED, with a payment in a terminal-failure state, are retryable
-- (proposal §31) — the orders guard trigger (0035) does not block
-- PAYMENT_FAILED -> PAYMENT_PROCESSING, and the payments guard trigger only
-- blocks leaving APPROVED, so this is a legitimate, allowed transition.

create or replace function public.retry_payment(p_order_id uuid)
returns table (
  payment_id uuid,
  reference text,
  currency text,
  total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order record;
  v_payment record;
  v_next_attempt int;
  v_reference text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_order from public.orders where id = p_order_id and user_id = v_user_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'PAYMENT_FAILED' then
    raise exception 'ORDER_NOT_RETRYABLE: order status is %', v_order.status;
  end if;

  select * into v_payment from public.payments where order_id = p_order_id order by created_at desc limit 1;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status not in ('DECLINED', 'ERROR', 'VOIDED', 'EXPIRED') then
    raise exception 'PAYMENT_NOT_RETRYABLE: payment status is %', v_payment.status;
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_next_attempt
  from public.payment_attempts where payment_id = v_payment.id;

  v_reference := 'ORDER-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8)) || '-A' || v_next_attempt;

  update public.payments
  set status = 'CREATED', provider_reference = v_reference, provider_transaction_id = null, failure_reason = null
  where id = v_payment.id;

  insert into public.payment_attempts (payment_id, attempt_number, reference, status, amount)
  values (v_payment.id, v_next_attempt, v_reference, 'CREATED', v_payment.amount);

  perform set_config('app.status_change_source', 'USER', true);
  perform set_config('app.status_change_reason', 'retry payment', true);

  update public.orders set status = 'PAYMENT_PROCESSING' where id = p_order_id;

  payment_id := v_payment.id;
  reference := v_reference;
  currency := v_payment.currency;
  total := v_order.total;
  return next;
end;
$$;

revoke all on function public.retry_payment(uuid) from public;
grant execute on function public.retry_payment(uuid) to authenticated;
