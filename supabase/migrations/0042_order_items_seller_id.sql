-- seller-order-management, 1.1: order_items.seller_id — snapshotted at
-- insert time (design.md Decision 1), same pattern as the already-snapshotted
-- product_name/unit_price, so ownership of a historical line item never
-- depends on a live join to products (which could be repriced/deleted
-- later). Backfill is defensive, in case any orders already exist from
-- checkout-orders-wompi testing before this column existed.

alter table public.order_items
  add column if not exists seller_id uuid references public.seller_profiles(id);

update public.order_items oi
set seller_id = p.tenant_id
from public.products p
where oi.product_id = p.id and oi.seller_id is null;

create index if not exists order_items_seller_id_idx on public.order_items (seller_id);

-- Additive seller-scoped read policy — the buyer/admin select policies from
-- 0031_orders_schema.sql are untouched.
create policy "order_items_select_seller" on public.order_items
  for select using (
    seller_id = (select id from public.seller_profiles where user_id = auth.uid())
  );

-- Extends create_order_with_items (0037, last modified by 0041's race-condition
-- fix) so every newly-created order_items row is born with seller_id already
-- set — otherwise every order created after this migration would need a
-- separate backfill step. Only the per-line insert changed: v_product now
-- also selects tenant_id, and the insert lists seller_id.
create or replace function public.create_order_with_items(
  p_idempotency_key text,
  p_pickup_point_id uuid,
  p_items jsonb,
  p_buyer_full_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_buyer_address text default null,
  p_notes text default null,
  p_expires_minutes int default 30
)
returns table (
  order_id uuid,
  payment_id uuid,
  reference text,
  currency text,
  total integer,
  is_existing boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_payment_id uuid;
  v_reference text;
  v_subtotal integer := 0;
  v_shipping_cost integer := 0;
  v_total integer;
  v_item record;
  v_product record;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- Idempotency: same buyer + same key returns the existing order/payment,
  -- never creates a second one (design.md Decision 3).
  select o.id, p.id, p.provider_reference, o.currency, o.total
    into v_order_id, v_payment_id, v_reference, currency, total
  from public.orders o
  join public.payments p on p.order_id = o.id
  where o.user_id = v_user_id and o.idempotency_key = p_idempotency_key
  order by p.created_at asc
  limit 1;

  if found then
    order_id := v_order_id;
    payment_id := v_payment_id;
    reference := v_reference;
    is_existing := true;
    return next;
    return;
  end if;

  -- Validate + price every line server-side; lock rows to prevent oversell
  -- under concurrent checkouts for the same product.
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'INVALID_QUANTITY: %', v_item.product_id;
    end if;

    select id, name, price, stock_quantity, status
      into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND: %', v_item.product_id;
    end if;
    if v_product.status <> 'ACTIVE' then
      raise exception 'PRODUCT_UNAVAILABLE: %', v_item.product_id;
    end if;
    if v_product.stock_quantity < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK: %', v_item.product_id;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
  end loop;

  -- Shipping: same function the buyer-facing preview calls (design.md Decision 4a).
  select coalesce(sum(shipping_cost), 0) into v_shipping_cost
  from public.get_shipping_estimate(p_pickup_point_id, p_items);

  v_total := v_subtotal + v_shipping_cost;

  -- Concurrency guard: two simultaneous requests with the same idempotency
  -- key can both reach this point (both passed the SELECT above before
  -- either committed). The UNIQUE(user_id, idempotency_key) constraint lets
  -- only one INSERT through; the loser recovers gracefully here instead of
  -- surfacing a raw 500.
  begin
    insert into public.orders (
      user_id, status, currency, subtotal, tax, shipping_cost, discount, total, idempotency_key,
      pickup_point_id, buyer_full_name, buyer_email, buyer_phone, buyer_address, notes, expires_at
    )
    values (
      v_user_id, 'PENDING_PAYMENT', 'COP', v_subtotal, 0, v_shipping_cost, 0, v_total, p_idempotency_key,
      p_pickup_point_id, p_buyer_full_name, p_buyer_email, p_buyer_phone, p_buyer_address, p_notes,
      now() + (p_expires_minutes || ' minutes')::interval
    )
    returning id into v_order_id;
  exception
    when unique_violation then
      select o.id, p.id, p.provider_reference, o.currency, o.total
        into v_order_id, v_payment_id, v_reference, currency, total
      from public.orders o
      join public.payments p on p.order_id = o.id
      where o.user_id = v_user_id and o.idempotency_key = p_idempotency_key
      order by p.created_at asc
      limit 1;

      order_id := v_order_id;
      payment_id := v_payment_id;
      reference := v_reference;
      is_existing := true;
      return next;
      return;
  end;

  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    select id, name, price, tenant_id into v_product from public.products where id = v_item.product_id;

    insert into public.order_items (order_id, product_id, product_name, seller_id, quantity, unit_price, subtotal)
    values (v_order_id, v_item.product_id, v_product.name, v_product.tenant_id, v_item.quantity, v_product.price, v_product.price * v_item.quantity);

    update public.products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id;
  end loop;

  v_reference := 'ORDER-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 8)) || '-A1';

  insert into public.payments (order_id, provider, provider_reference, status, amount, currency)
  values (v_order_id, 'WOMPI', v_reference, 'CREATED', v_total, 'COP')
  returning id into v_payment_id;

  insert into public.payment_attempts (payment_id, attempt_number, reference, status, amount)
  values (v_payment_id, 1, v_reference, 'CREATED', v_total);

  perform set_config('app.status_change_source', 'USER', true);
  perform set_config('app.status_change_reason', 'checkout iniciado', true);

  update public.orders
  set status = 'PAYMENT_PROCESSING'
  where id = v_order_id and status = 'PENDING_PAYMENT';

  order_id := v_order_id;
  payment_id := v_payment_id;
  reference := v_reference;
  currency := 'COP';
  total := v_total;
  is_existing := false;
  return next;
end;
$$;

revoke all on function public.create_order_with_items(text, uuid, jsonb, text, text, text, text, text, int) from public;
grant execute on function public.create_order_with_items(text, uuid, jsonb, text, text, text, text, text, int) to authenticated;
