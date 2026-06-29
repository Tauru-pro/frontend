-- RLS for profiles/seller_profiles/customer_profiles, plus a trigger that
-- blocks non-SUPER_ADMIN callers from changing their own role/status (RLS
-- alone is row-level, not column-level, so this needs a BEFORE UPDATE check).

alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.customer_profiles enable row level security;

-- profiles: a user can always read their own row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- profiles: SUPER_ADMIN can read every row.
create policy "profiles_select_super_admin" on public.profiles
  for select using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

-- profiles: a user can update their own row (role/status are further
-- locked down by the trigger below, regardless of this policy).
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- profiles: SUPER_ADMIN has full read/write access.
create policy "profiles_all_super_admin" on public.profiles
  for all using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

-- Deliberately no INSERT policy: rows are only created by the
-- handle_new_user trigger (SECURITY DEFINER) or by the service_role key
-- used inside the admin-create-user Edge Function — never directly by a
-- client.

create or replace function public.protect_role_and_status()
returns trigger
language plpgsql
as $$
begin
  -- service_role (the admin-create-user Edge Function, the seed script)
  -- bypasses RLS policies but NOT triggers, so it must be allowed explicitly.
  if current_user = 'service_role' then
    return new;
  end if;

  if (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN' then
    return new;
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    raise exception 'Only SUPER_ADMIN can change role or status';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_role_and_status_trigger on public.profiles;
create trigger protect_role_and_status_trigger
  before update on public.profiles
  for each row execute function public.protect_role_and_status();

-- seller_profiles / customer_profiles: owner has full access to their own
-- row, SUPER_ADMIN has full access to all rows.
create policy "seller_profiles_owner" on public.seller_profiles
  for all using (auth.uid() = user_id or (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "customer_profiles_owner" on public.customer_profiles
  for all using (auth.uid() = user_id or (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');
