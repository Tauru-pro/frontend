-- Orders + order_items: part of checkout-orders-wompi. Orders are created
-- exclusively by the create-checkout Edge Function (service_role), never
-- directly by the client — buyers only ever SELECT their own orders here.
-- idempotency_key + UNIQUE(user_id, idempotency_key) is what makes
-- create-checkout safe against double-click/double-tab/refresh-resubmit
-- (see design.md Decision 3).

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  status           text not null default 'PENDING_PAYMENT' check (status in (
                     'PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'PROCESSING',
                     'SHIPPED', 'COMPLETED', 'PAYMENT_FAILED', 'CANCELLED', 'EXPIRED'
                   )),
  currency         text not null default 'COP',
  subtotal         integer not null,
  tax              integer not null default 0,
  shipping_cost    integer not null default 0,
  discount         integer not null default 0,
  total            integer not null,
  idempotency_key  text not null,
  -- Shipping-time snapshot: the buyer fills these per checkout (may differ
  -- from their saved customer_profiles row), and the order needs to remember
  -- which pickup point was chosen — not just the cost, but the destination.
  pickup_point_id  uuid references public.pickup_points (id),
  buyer_full_name  text not null,
  buyer_email      text not null,
  buyer_phone      text,
  buyer_address    text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  expires_at       timestamptz,
  paid_at          timestamptz,
  cancelled_at     timestamptz,
  completed_at     timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_expires_at_idx on public.orders (status, expires_at);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

-- Buyers read only their own orders. All writes (insert/update/delete) go
-- through service_role Edge Functions (create-checkout, wompi-webhook,
-- retry-payment, expire-orders, reconcile-payments), which bypass RLS —
-- there is deliberately no client-facing insert/update/delete policy.
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_select_admin" on public.orders
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  product_id          uuid not null references public.products (id),
  product_name        text not null,
  product_variant_id  uuid,
  quantity            integer not null check (quantity > 0),
  unit_price          integer not null,
  subtotal            integer not null,
  created_at          timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

alter table public.order_items enable row level security;

create policy "order_items_select_own" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

create policy "order_items_select_admin" on public.order_items
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));
