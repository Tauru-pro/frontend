-- seller-order-management, 1.3: order_fulfillment_history — mirrors
-- order_status_history's shape (0034), audit trail for every
-- order_seller_fulfillments status change. Populated only by
-- update_order_fulfillment_status() (0047, security definer) in the same
-- transaction as the status update — no client write policy, same
-- defense-in-depth as order_seller_fulfillments itself.

create table if not exists public.order_fulfillment_history (
  id             uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references public.order_seller_fulfillments(id) on delete cascade,
  order_id       uuid not null references public.orders(id) on delete cascade,
  seller_id      uuid not null references public.seller_profiles(id),
  from_status    text,
  to_status      text not null,
  actor_type     text not null check (actor_type in ('SELLER', 'SYSTEM', 'ADMIN')),
  actor_id       uuid,
  reason         text,
  created_at     timestamptz not null default now()
);

create index if not exists order_fulfillment_history_fulfillment_id_idx on public.order_fulfillment_history (fulfillment_id);
create index if not exists order_fulfillment_history_seller_id_idx on public.order_fulfillment_history (seller_id);

alter table public.order_fulfillment_history enable row level security;

create policy "order_fulfillment_history_select_own" on public.order_fulfillment_history
  for select using (
    seller_id = (select id from public.seller_profiles where user_id = auth.uid())
  );

create policy "order_fulfillment_history_select_admin" on public.order_fulfillment_history
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));
