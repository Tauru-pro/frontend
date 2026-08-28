-- seller-dashboard-commissions-settlements, 6.1: get_seller_dashboard_summary
-- — the single server-side aggregation backing the seller dashboard
-- (design.md Decision 12/proposal §32/§33). Resolves the seller from
-- auth.uid(), exactly like get_seller_orders (0046) — a client can never
-- request another seller's figures. All five "for the selected period"
-- figures (gross sales, collected, commission, net, pending settlement,
-- settled) are scoped to seller_earnings.created_at within
-- [p_date_from, p_date_to), consistent with the seller-dashboard spec:
-- "pending settlement" here means "of what was sold in this period, how
-- much is still unsettled" — not an unscoped running balance.
--
-- doses_sold joins order_items back through seller_earnings (never counted
-- from orders/order_items alone) so that only items belonging to an order
-- that produced a real, non-reversed earning are counted — this is how
-- CANCELLED/never-approved orders are structurally excluded (proposal §19),
-- and how a REVERSED sale's doses stop counting without a separate
-- order-status check.

create or replace function public.get_seller_dashboard_summary(
  p_date_from timestamptz default now() - interval '30 days',
  p_date_to timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_gross_sales numeric := 0;
  v_orders_count int := 0;
  v_doses_sold numeric := 0;
  v_avg_order numeric := 0;
  v_commission numeric := 0;
  v_net numeric := 0;
  v_pending numeric := 0;
  v_settled numeric := 0;
begin
  select id into v_seller_id from public.seller_profiles where user_id = auth.uid();

  if v_seller_id is null then
    return jsonb_build_object(
      'grossSales', 0, 'ordersCount', 0, 'dosesSold', 0, 'averageOrderValue', 0,
      'totalCollected', 0, 'platformCommission', 0, 'sellerNet', 0,
      'pendingSettlement', 0, 'settledAmount', 0
    );
  end if;

  select
    coalesce(sum(gross_amount), 0),
    count(distinct order_id),
    coalesce(sum(commission_amount), 0),
    coalesce(sum(seller_net_amount), 0)
  into v_gross_sales, v_orders_count, v_commission, v_net
  from public.seller_earnings
  where seller_id = v_seller_id
    and status <> 'REVERSED'
    and created_at >= p_date_from
    and created_at < p_date_to;

  v_avg_order := case when v_orders_count > 0 then round(v_gross_sales / v_orders_count) else 0 end;

  select coalesce(sum(oi.quantity), 0) into v_doses_sold
  from public.order_items oi
  join public.seller_earnings se on se.order_id = oi.order_id and se.seller_id = oi.seller_id
  where oi.seller_id = v_seller_id
    and se.status <> 'REVERSED'
    and se.created_at >= p_date_from
    and se.created_at < p_date_to;

  select coalesce(sum(seller_net_amount), 0) into v_pending
  from public.seller_earnings
  where seller_id = v_seller_id
    and status in ('AVAILABLE', 'IN_SETTLEMENT')
    and created_at >= p_date_from
    and created_at < p_date_to;

  select coalesce(sum(seller_net_amount), 0) into v_settled
  from public.seller_earnings
  where seller_id = v_seller_id
    and status = 'SETTLED'
    and created_at >= p_date_from
    and created_at < p_date_to;

  return jsonb_build_object(
    'grossSales', v_gross_sales,
    'ordersCount', v_orders_count,
    'dosesSold', v_doses_sold,
    'averageOrderValue', v_avg_order,
    'totalCollected', v_gross_sales,
    'platformCommission', v_commission,
    'sellerNet', v_net,
    'pendingSettlement', v_pending,
    'settledAmount', v_settled
  );
end;
$$;

revoke all on function public.get_seller_dashboard_summary(timestamptz, timestamptz) from public;
grant execute on function public.get_seller_dashboard_summary(timestamptz, timestamptz) to authenticated;
