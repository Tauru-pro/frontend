-- Core identity/role table plus the per-role profile tables it replaces
-- (buyer_profiles is renamed to customer_profiles as part of this migration set).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'CUSTOMER' check (role in ('SUPER_ADMIN', 'ADMIN', 'SELLER', 'CUSTOMER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now()
);

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text,
  contact_phone text,
  logo_key text,
  city_id uuid,
  address text,
  status text default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'SUSPENDED'))
);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  full_name text,
  phone text,
  city_id uuid,
  herd_size text,
  buyer_type text,
  whatsapp text
);

create index if not exists seller_profiles_user_id_idx on public.seller_profiles (user_id);
create index if not exists customer_profiles_user_id_idx on public.customer_profiles (user_id);
