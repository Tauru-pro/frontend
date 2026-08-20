-- Backstop guards against the two transitions that must never happen,
-- regardless of which Edge Function (or manual SQL) attempts them (design.md
-- Decision 5). This is deliberately narrower than freezing every
-- terminal-looking status: payment_attempts/retry-payment legitimately moves
-- a `payments` row back to CREATED/PENDING for a new attempt after DECLINED/
-- ERROR/VOIDED/EXPIRED, so only APPROVED is a hard stop on `payments`; only
-- the fulfillment-sequence-to-pending regression and COMPLETED/CANCELLED are
-- hard stops on `orders`.

create or replace function public.guard_payment_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'APPROVED' and new.status is distinct from 'APPROVED' then
    raise exception 'INVALID_PAYMENT_TRANSITION: an APPROVED payment cannot change status (attempted %)', new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_guard_status_transition on public.payments;
create trigger payments_guard_status_transition
  before update of status on public.payments
  for each row execute function public.guard_payment_status_transition();

create or replace function public.guard_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('COMPLETED', 'CANCELLED') and new.status is distinct from old.status then
    raise exception 'INVALID_ORDER_TRANSITION: order is % and cannot change status (attempted %)', old.status, new.status;
  end if;

  if old.status in ('PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED')
     and new.status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING') then
    raise exception 'INVALID_ORDER_TRANSITION: order already reached % and cannot revert to %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_status_transition on public.orders;
create trigger orders_guard_status_transition
  before update of status on public.orders
  for each row execute function public.guard_order_status_transition();

-- Enables the buyer dashboard / checkout-result page to subscribe to
-- postgres_changes on their own orders/payments (Realtime respects RLS).
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.payments;
