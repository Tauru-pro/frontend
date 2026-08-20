-- order_status_history: audit trail of every orders.status transition
-- (proposal §41). Populated automatically by a trigger rather than by each
-- Edge Function remembering to insert a row — so a manual `update orders set
-- status = ...` (e.g. from the SQL editor during an incident) is still
-- captured. `source`/`reason`/`metadata` are set via a Postgres session
-- variable (`app.status_change_source` / `app.status_change_reason`) that
-- each Edge Function sets with `set_config(...)` immediately before its
-- UPDATE, defaulting to 'SYSTEM' when unset (e.g. a manual SQL update).

create table if not exists public.order_status_history (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  reason       text,
  source       text not null default 'SYSTEM',
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id);

alter table public.order_status_history enable row level security;

create policy "order_status_history_select_own" on public.order_status_history
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id and o.user_id = auth.uid()
    )
  );

create policy "order_status_history_select_admin" on public.order_status_history
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, source, reason)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(nullif(current_setting('app.status_change_source', true), ''), 'SYSTEM'),
      nullif(current_setting('app.status_change_reason', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status_change on public.orders;
create trigger orders_log_status_change
  after update of status on public.orders
  for each row execute function public.log_order_status_change();
