-- Bugfix found via live sandbox test: create_order_with_items() created every
-- order as PENDING_PAYMENT and never advanced it to PAYMENT_PROCESSING.
-- apply_payment_approved()'s orders UPDATE only fires `WHERE status =
-- 'PAYMENT_PROCESSING'`, so it silently matched zero rows — payments.status
-- correctly went to APPROVED, but orders.status stayed stuck at
-- PENDING_PAYMENT forever, even for a fully approved payment. See
-- design.md Decision 4/4b for context.
--
-- Fix: create_order_with_items now advances the order to PAYMENT_PROCESSING
-- in the same transaction, right after creating the payment/payment_attempts
-- row (this is genuinely "checkout was started" — a Wompi reference now
-- exists). expire_order's WHERE is broadened to also catch orders stuck in
-- PAYMENT_PROCESSING, since that's now the real resting state for an
-- abandoned/never-completed checkout (PENDING_PAYMENT is a near-instant
-- transient state once this fix ships).

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

  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    select id, name, price into v_product from public.products where id = v_item.product_id;

    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    values (v_order_id, v_item.product_id, v_product.name, v_item.quantity, v_product.price, v_product.price * v_item.quantity);

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

  -- Checkout has now genuinely started (a Wompi reference/attempt exists) —
  -- advance the order past PENDING_PAYMENT so a later APPROVED webhook's
  -- conditional `WHERE status = 'PAYMENT_PROCESSING'` actually matches.
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
  where id = p_order_id and status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING') and expires_at < now();

  if found then
    v_updated := true;
    perform public.restore_order_stock(p_order_id);
  end if;

  return v_updated;
end;
$$;

revoke all on function public.create_order_with_items(text, uuid, jsonb, text, text, text, text, text, int) from public;
grant execute on function public.create_order_with_items(text, uuid, jsonb, text, text, text, text, text, int) to authenticated;

revoke all on function public.expire_order(uuid) from public;
grant execute on function public.expire_order(uuid) to service_role;
