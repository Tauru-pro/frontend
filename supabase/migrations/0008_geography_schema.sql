-- Geography catalog: countries, states (departments), cities (municipalities)
-- Public read-only reference data; only service_role can write (via RLS bypass).

create table if not exists public.countries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.states (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  country_id uuid not null references public.countries (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, name)
);

create table if not exists public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  state_id   uuid not null references public.states (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_id, name)
);

-- Reuse the existing set_updated_at() trigger function (created in 0005).
create trigger set_updated_at_countries
  before update on public.countries
  for each row execute function public.set_updated_at();

create trigger set_updated_at_states
  before update on public.states
  for each row execute function public.set_updated_at();

create trigger set_updated_at_cities
  before update on public.cities
  for each row execute function public.set_updated_at();

-- Row Level Security: publicly readable, no write policies (service_role bypasses RLS).
alter table public.countries enable row level security;
alter table public.states    enable row level security;
alter table public.cities    enable row level security;

create policy "public read countries" on public.countries
  for select using (true);

create policy "public read states" on public.states
  for select using (true);

create policy "public read cities" on public.cities
  for select using (true);

-- Wire up the FK that was left as a bare uuid in 0007 (branches.city_id → cities.id).
-- Only add the constraint when it doesn't already exist to keep the migration idempotent.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'branches_city_id_fkey'
      and table_name = 'branches'
      and table_schema = 'public'
  ) then
    alter table public.branches
      add constraint branches_city_id_fkey
      foreign key (city_id) references public.cities (id);
  end if;
end;
$$;
