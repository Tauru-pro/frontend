-- Módulo 3 (Infraestructura Descentralizada): branches owned by a tenant
-- (seller_profiles.id), isolated by the verified tenant_id JWT claim from
-- custom_access_token_hook (migrate-seller-identity-to-supabase) — the
-- first real consumer of that claim, per RF-005.

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.seller_profiles (id) on delete cascade,
  name text not null,
  address text not null,
  phone text,
  city_id uuid,
  latitude numeric,
  longitude numeric,
  business_hours text,
  is_main boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists branches_tenant_id_idx on public.branches (tenant_id);

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

alter table public.branches enable row level security;

create policy "branches_owner" on public.branches
  for all
  using ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id)
  with check ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id);

create policy "branches_select_admin" on public.branches
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- Keeps "exactly one main branch per tenant" true without requiring
-- BranchService to do a two-step unset-then-set: marking a branch main
-- atomically unmarks the previous one, and a tenant's first branch is
-- marked main automatically so there's never a tenant with branches but no
-- main branch.
create or replace function public.enforce_single_main_branch()
returns trigger
language plpgsql
as $$
begin
  if new.is_main then
    update public.branches
    set is_main = false
    where tenant_id = new.tenant_id and id <> new.id and is_main;
  elsif tg_op = 'INSERT' and not exists (
    select 1 from public.branches where tenant_id = new.tenant_id
  ) then
    new.is_main := true;
  end if;
  return new;
end;
$$;

drop trigger if exists branches_enforce_single_main on public.branches;
create trigger branches_enforce_single_main
  before insert or update on public.branches
  for each row execute function public.enforce_single_main_branch();
