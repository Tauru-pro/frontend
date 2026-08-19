-- Pickup points ("puntos de recogida") are a marketplace-wide setting, not a
-- seller's own data — same shape as `breeds` (0005): public read, writes
-- restricted to SUPER_ADMIN via the user_role JWT claim. city_id/latitude/
-- longitude mirror how `branches` (0007) already stores a located business
-- entity. `status` follows the same ACTIVE/INACTIVE convention already used
-- by branches/seller_profiles/products, for the activate/deactivate action.
--
-- This table never existed before — the admin CRUD was still calling a
-- legacy REST backend (`${environment.apiUrl}/pickup-points`) that no longer
-- exists in this stack, which is why every operation (list/create/edit/
-- delete) was failing.

create table if not exists public.pickup_points (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text not null,
  city_id    uuid not null references public.cities(id),
  latitude   numeric,
  longitude  numeric,
  status     text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pickup_points enable row level security;

create policy "pickup_points_select_all" on public.pickup_points
  for select using (true);

create policy "pickup_points_write_super_admin" on public.pickup_points
  for insert with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "pickup_points_update_super_admin" on public.pickup_points
  for update using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "pickup_points_delete_super_admin" on public.pickup_points
  for delete using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

-- Reuses the set_updated_at() function already defined in 0005_breeds_schema.sql.
drop trigger if exists pickup_points_set_updated_at on public.pickup_points;
create trigger pickup_points_set_updated_at
  before update on public.pickup_points
  for each row execute function public.set_updated_at();
