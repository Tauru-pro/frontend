-- seller-order-management, 2.1/2.2: seller-scoped, read-only RPCs.
--
-- Sellers never get RLS select on orders or payments directly (design.md
-- Decision 4) — a matching row would make the entire orders/payments row
-- readable, including total/amount, which are whole-order figures a
-- co-seller in a multi-seller order has no right to see. These two
-- security-definer functions resolve the caller's seller_profiles.id from
-- auth.uid() (never a client-supplied id, same pattern as
-- create_order_with_items) and shape a seller-safe response instead.

create or replace function public.get_seller_orders(
  p_status text default null,
  p_payment_status text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_search text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_page_size int := greatest(coalesce(p_page_size, 20), 1);
  v_offset int;
  v_total int := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  select id into v_seller_id from public.seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    return jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', v_page, 'pageSize', v_page_size, 'totalPages', 0);
  end if;

  v_offset := (v_page - 1) * v_page_size;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'orderId', t."orderId",
      'createdAt', t."createdAt",
      'buyerName', t."buyerName",
      'fulfillmentStatus', t."fulfillmentStatus",
      'fulfillmentUpdatedAt', t."fulfillmentUpdatedAt",
      'paymentStatus', t."paymentStatus",
      'itemCount', t."itemCount",
      'sellerSubtotal', t."sellerSubtotal"
    )), '[]'::jsonb),
    coalesce(max(t.full_count), 0)
  into v_rows, v_total
  from (
    select
      o.id as "orderId",
      o.created_at as "createdAt",
      o.buyer_full_name as "buyerName",
      f.status as "fulfillmentStatus",
      f.updated_at as "fulfillmentUpdatedAt",
      pay.status as "paymentStatus",
      (
        select count(*) from public.order_items oi2
        where oi2.order_id = o.id and oi2.seller_id = v_seller_id
      )::int as "itemCount",
      (
        select coalesce(sum(oi2.subtotal), 0) from public.order_items oi2
        where oi2.order_id = o.id and oi2.seller_id = v_seller_id
      ) as "sellerSubtotal",
      count(*) over() as full_count
    from public.orders o
    join public.order_seller_fulfillments f on f.order_id = o.id and f.seller_id = v_seller_id
    left join lateral (
      select p.status from public.payments p where p.order_id = o.id order by p.created_at desc limit 1
    ) pay on true
    where
      (p_status is null or f.status = p_status)
      and (p_payment_status is null or pay.status = p_payment_status)
      and (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at <= p_date_to)
      and (
        p_search is null or btrim(p_search) = '' or
        o.id::text ilike '%' || p_search || '%' or
        o.buyer_full_name ilike '%' || p_search || '%'
      )
    order by o.created_at desc
    offset v_offset limit v_page_size
  ) t;

  return jsonb_build_object(
    'data', v_rows,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', ceil(v_total::numeric / v_page_size)::int
  );
end;
$$;

revoke all on function public.get_seller_orders(text, text, timestamptz, timestamptz, text, int, int) from public;
grant execute on function public.get_seller_orders(text, text, timestamptz, timestamptz, text, int, int) to authenticated;

create or replace function public.get_seller_order_detail(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_order record;
  v_fulfillment record;
  v_items jsonb;
  v_history jsonb;
  v_payment jsonb;
  v_pickup jsonb;
begin
  select id into v_seller_id from public.seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    return null;
  end if;

  -- No data at all if the caller has no items on this order — never an
  -- error that would leak the order's existence (design.md Decision 4).
  if not exists (
    select 1 from public.order_items oi where oi.order_id = p_order_id and oi.seller_id = v_seller_id
  ) then
    return null;
  end if;

  select o.id, o.created_at, o.buyer_full_name, o.buyer_email, o.buyer_phone, o.pickup_point_id
    into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    return null;
  end if;

  -- Pickup point only — orders.buyer_address is intentionally excluded
  -- (user-confirmed, design.md Decision 4 / resolved Open Question).
  select jsonb_build_object('name', pp.name, 'address', pp.address)
    into v_pickup
  from public.pickup_points pp
  where pp.id = v_order.pickup_point_id;

  select jsonb_agg(jsonb_build_object(
      'id', oi.id,
      'productId', oi.product_id,
      'productName', oi.product_name,
      'quantity', oi.quantity,
      'unitPrice', oi.unit_price,
      'subtotal', oi.subtotal
    ) order by oi.created_at)
    into v_items
  from public.order_items oi
  where oi.order_id = p_order_id and oi.seller_id = v_seller_id;

  select f.id, f.status, f.cancelled_reason, f.created_at, f.updated_at
    into v_fulfillment
  from public.order_seller_fulfillments f
  where f.order_id = p_order_id and f.seller_id = v_seller_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'fromStatus', h.from_status,
      'toStatus', h.to_status,
      'actorType', h.actor_type,
      'reason', h.reason,
      'createdAt', h.created_at
    ) order by h.created_at), '[]'::jsonb)
    into v_history
  from public.order_fulfillment_history h
  where h.fulfillment_id = v_fulfillment.id;

  -- Safe payment DTO: status/method/provider reference/transaction id/
  -- approval date only — never amount, never raw_response (design.md
  -- Decision 4).
  select jsonb_build_object(
      'status', p.status,
      'paymentMethod', p.payment_method,
      'providerReference', p.provider_reference,
      'providerTransactionId', p.provider_transaction_id,
      'approvedAt', p.approved_at
    )
    into v_payment
  from public.payments p
  where p.order_id = p_order_id
  order by p.created_at desc
  limit 1;

  return jsonb_build_object(
    'orderId', v_order.id,
    'createdAt', v_order.created_at,
    'buyerName', v_order.buyer_full_name,
    'buyerEmail', v_order.buyer_email,
    'buyerPhone', v_order.buyer_phone,
    'pickupPoint', v_pickup,
    'items', coalesce(v_items, '[]'::jsonb),
    'sellerSubtotal', (
      select coalesce(sum(oi.subtotal), 0) from public.order_items oi
      where oi.order_id = p_order_id and oi.seller_id = v_seller_id
    ),
    'fulfillment', jsonb_build_object(
      'id', v_fulfillment.id,
      'status', v_fulfillment.status,
      'cancelledReason', v_fulfillment.cancelled_reason,
      'createdAt', v_fulfillment.created_at,
      'updatedAt', v_fulfillment.updated_at
    ),
    'history', v_history,
    'payment', v_payment
  );
end;
$$;

revoke all on function public.get_seller_order_detail(uuid) from public;
grant execute on function public.get_seller_order_detail(uuid) to authenticated;
