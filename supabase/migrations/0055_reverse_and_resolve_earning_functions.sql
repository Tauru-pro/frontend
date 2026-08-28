-- seller-dashboard-commissions-settlements, 3.4/3.5: resolve_earning_commission
-- (closes the design.md Decision 7 gap once an admin fixes a seller's
-- segment/commission configuration) and reverse_seller_earning (design.md
-- Decision 8 — a compensating entry, never an in-place edit or delete,
-- regardless of the original earning's current status).

create or replace function public.resolve_earning_commission(
  p_earning_id uuid,
  p_commission_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross integer;
  v_commission integer;
  v_status text;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  select gross_amount, status into v_gross, v_status
  from public.seller_earnings
  where id = p_earning_id and needs_commission_review;

  if not found then
    raise exception 'EARNING_NOT_FLAGGED';
  end if;

  v_commission := round(v_gross * p_commission_rate / 100);

  update public.seller_earnings
  set commission_rate = p_commission_rate,
      commission_amount = v_commission,
      seller_net_amount = v_gross - v_commission,
      needs_commission_review = false,
      status = case when v_status = 'PENDING' then 'AVAILABLE' else v_status end
  where id = p_earning_id;
end;
$$;

revoke all on function public.resolve_earning_commission(uuid, numeric) from public;
grant execute on function public.resolve_earning_commission(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_seller_earning: the original row is marked REVERSED and left
-- untouched otherwise (proposal §28 — no editing/deleting history). A new
-- negative-amount row is inserted as AVAILABLE so it nets off automatically
-- in the seller's next settlement (proposal §29), whether the original was
-- AVAILABLE, IN_SETTLEMENT, or already SETTLED. Not idempotent by design —
-- an admin calling this twice on the same earning is a distinct clerical
-- error (double reversal), not a retried webhook, so it is not guarded by a
-- unique-constraint dedupe like payment-approval processing is; the
-- `original.status = 'REVERSED'` check below still stops re-reversing the
-- exact same row twice.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_seller_earning(
  p_earning_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original record;
  v_reversal_id uuid;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_original from public.seller_earnings where id = p_earning_id;
  if not found then
    raise exception 'EARNING_NOT_FOUND';
  end if;
  if v_original.status = 'REVERSED' then
    raise exception 'ALREADY_REVERSED';
  end if;

  update public.seller_earnings set status = 'REVERSED' where id = p_earning_id;

  insert into public.seller_earnings (
    seller_id, order_id, payment_id, gross_amount,
    commission_rate, commission_amount, seller_net_amount,
    status, reversal_of_earning_id
  )
  values (
    v_original.seller_id, v_original.order_id, v_original.payment_id, -v_original.gross_amount,
    v_original.commission_rate, -v_original.commission_amount, -v_original.seller_net_amount,
    'AVAILABLE', p_earning_id
  )
  returning id into v_reversal_id;

  return v_reversal_id;
end;
$$;

revoke all on function public.reverse_seller_earning(uuid, text) from public;
grant execute on function public.reverse_seller_earning(uuid, text) to authenticated;
