-- seller-order-management, 1.2: order_seller_fulfillments — one row per
-- distinct seller present in an order (design.md Decision 2), tracking that
-- seller's own PROCESSING/SHIPPED/COMPLETED/CANCELLED progress independently
-- of orders.status (the payment-driven, buyer-facing aggregate, owned by
-- checkout-orders-wompi and never written to by this change).
--
-- Deliberately no insert/update/delete policy for any client role — the only
-- write path is update_order_fulfillment_status() (0047, security definer),
-- called only via the seller-orders-fulfillment Edge Function (design.md
-- Decision 5). RLS enabled with no matching write policy means Postgres
-- rejects the write outright, regardless of what the client attempts.

create table if not exists public.order_seller_fulfillments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  seller_id        uuid not null references public.seller_profiles(id),
  status           text not null default 'RECEIVED' check (status in (
                     'RECEIVED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'
                   )),
  cancelled_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (order_id, seller_id)
);

create index if not exists order_seller_fulfillments_seller_id_idx on public.order_seller_fulfillments (seller_id);
create index if not exists order_seller_fulfillments_order_id_idx on public.order_seller_fulfillments (order_id);

alter table public.order_seller_fulfillments enable row level security;

create policy "order_seller_fulfillments_select_own" on public.order_seller_fulfillments
  for select using (
    seller_id = (select id from public.seller_profiles where user_id = auth.uid())
  );

create policy "order_seller_fulfillments_select_admin" on public.order_seller_fulfillments
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

drop trigger if exists order_seller_fulfillments_set_updated_at on public.order_seller_fulfillments;
create trigger order_seller_fulfillments_set_updated_at
  before update on public.order_seller_fulfillments
  for each row execute function public.set_updated_at();

-- Lets sellers subscribe to postgres_changes directly on this table
-- (design.md Decision 6) — RLS already scopes what each subscriber receives.
alter publication supabase_realtime add table public.order_seller_fulfillments;
