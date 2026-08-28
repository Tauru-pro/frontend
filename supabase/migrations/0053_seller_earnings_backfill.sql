-- seller-dashboard-commissions-settlements, 3.3: one-time backfill of
-- seller_earnings for payments that were already APPROVED before this
-- change shipped (and therefore never went through 0052's block). There is
-- no true historical commission rate for these — none was ever recorded —
-- so the rate applied here is whatever resolves at backfill time (or the
-- needs_commission_review fallback if none does). Every backfilled row is
-- marked backfilled = true so it is distinguishable from a rate genuinely
-- frozen at real approval time (design.md Risks).

do $$
declare
  v_payment record;
  v_seller record;
  v_gross integer;
  v_rate numeric(5,2);
  v_commission integer;
begin
  for v_payment in
    select p.id as payment_id, p.order_id
    from public.payments p
    where p.status = 'APPROVED'
      and not exists (
        select 1 from public.seller_earnings se where se.payment_id = p.id
      )
  loop
    for v_seller in
      select oi.seller_id as id, sp.segment_id, sum(oi.subtotal) as gross_amount
      from public.order_items oi
      join public.seller_profiles sp on sp.id = oi.seller_id
      where oi.order_id = v_payment.order_id and oi.seller_id is not null
      group by oi.seller_id, sp.segment_id
    loop
      v_gross := v_seller.gross_amount;
      v_rate := null;

      if v_seller.segment_id is not null then
        v_rate := public.get_current_commission_rate(v_seller.segment_id, now());
      end if;

      if v_rate is null then
        insert into public.seller_earnings (
          seller_id, order_id, payment_id, gross_amount,
          commission_rate, commission_amount, seller_net_amount,
          status, needs_commission_review, backfilled
        )
        values (
          v_seller.id, v_payment.order_id, v_payment.payment_id, v_gross,
          0, 0, v_gross,
          'PENDING', true, true
        )
        on conflict (payment_id, seller_id) where reversal_of_earning_id is null do nothing;
      else
        v_commission := round(v_gross * v_rate / 100);

        insert into public.seller_earnings (
          seller_id, order_id, payment_id, gross_amount,
          commission_rate, commission_amount, seller_net_amount,
          status, needs_commission_review, backfilled
        )
        values (
          v_seller.id, v_payment.order_id, v_payment.payment_id, v_gross,
          v_rate, v_commission, v_gross - v_commission,
          'AVAILABLE', false, true
        )
        on conflict (payment_id, seller_id) where reversal_of_earning_id is null do nothing;
      end if;
    end loop;
  end loop;
end;
$$;
