-- Breed catalog: public read (used by the public marketplace and the
-- seller bull-listing form with no session), writes restricted to
-- SUPER_ADMIN via the user_role JWT claim from custom_access_token_hook.

create table if not exists public.breeds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  purpose text not null check (purpose in ('MILK', 'MEAT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.breeds enable row level security;

create policy "breeds_select_all" on public.breeds
  for select using (true);

create policy "breeds_write_super_admin" on public.breeds
  for insert with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "breeds_update_super_admin" on public.breeds
  for update using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "breeds_delete_super_admin" on public.breeds
  for delete using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists breeds_set_updated_at on public.breeds;
create trigger breeds_set_updated_at
  before update on public.breeds
  for each row execute function public.set_updated_at();
