-- Checkout should be able to prefill the buyer's address for a logged-in
-- customer, and the profile page should let them save one. customer_profiles
-- has had a bare `city_id uuid` since 0001 (unlike seller_profiles/branches,
-- which got a real FK), and never had an `address` column at all.

alter table public.customer_profiles
  add column if not exists address text;

-- Wire up the FK left bare since 0001 (customer_profiles.city_id -> cities.id),
-- same fix 0008 already did for branches.city_id. Idempotent.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'customer_profiles_city_id_fkey'
      and table_name = 'customer_profiles'
      and table_schema = 'public'
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_city_id_fkey
      foreign key (city_id) references public.cities (id);
  end if;
end;
$$;
