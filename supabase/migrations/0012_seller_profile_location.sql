-- Aligns seller_profiles with the become-seller form:
--   * drops country / business_hours (the form no longer collects them)
--   * gives city_id a real FK, so the onboarding can store a catalog city and
--     PostgREST can resolve the `cities(...)` embed that seller.service and
--     UserStore now select (without it, loading the user profile 400s)
--   * rewrites submit_seller_onboarding() accordingly
--
-- This lives in its own migration because 0011 is already applied to the linked
-- project (`migration list --linked` shows it under Remote); editing 0011 in
-- place would be silently skipped by `supabase db push`.

-- ---------------------------------------------------------------------------
-- 1. Drop the fields the onboarding no longer collects
-- ---------------------------------------------------------------------------
-- country was always 'Colombia' (single-country marketplace) and the operating
-- schedule belongs to each branch (branches.business_hours, 0007), not to the
-- store as a whole. Both were added by 0006, also already applied.
--
-- DESTRUCTIVE: back up anything worth keeping before applying, e.g.
--   create table public.seller_profiles_legacy_fields as
--     select id, user_id, country, business_hours from public.seller_profiles;
alter table public.seller_profiles
  drop column if exists country,
  drop column if exists business_hours;

-- ---------------------------------------------------------------------------
-- 2. Wire up seller_profiles.city_id -> cities.id
-- ---------------------------------------------------------------------------
-- city_id has been a bare uuid since 0001 (0008 only wired branches.city_id),
-- so nothing guaranteed it points at a real city. Null out any value that
-- doesn't resolve, otherwise adding the constraint fails on existing rows.
update public.seller_profiles sp
  set city_id = null
  where sp.city_id is not null
    and not exists (select 1 from public.cities c where c.id = sp.city_id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'seller_profiles_city_id_fkey'
      and table_name = 'seller_profiles'
  ) then
    alter table public.seller_profiles
      add constraint seller_profiles_city_id_fkey
      foreign key (city_id) references public.cities (id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Rewrite the promotion function without the dropped columns
-- ---------------------------------------------------------------------------
-- Same signature as the 0011 version, so CREATE OR REPLACE keeps the existing
-- grants (execute revoked from public/anon/authenticated, granted to service_role).
create or replace function public.submit_seller_onboarding(
  p_user_id uuid,
  p_company jsonb,
  p_responses jsonb,
  p_seller_terms_version text
)
returns void
language plpgsql
as $$
declare
  r jsonb;
begin
  -- Only promote an account that is currently a CUSTOMER.
  if (select role from public.profiles where id = p_user_id) is distinct from 'CUSTOMER' then
    raise exception 'USER_NOT_CUSTOMER';
  end if;

  -- Company data -> seller_profiles (create on first save, update on retry).
  insert into public.seller_profiles (
    user_id, business_name, description, contact_phone, address, city_id, status
  )
  values (
    p_user_id,
    p_company ->> 'business_name',
    p_company ->> 'description',
    p_company ->> 'contact_phone',
    p_company ->> 'address',
    nullif(p_company ->> 'city_id', '')::uuid,
    'PENDING'
  )
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    description = excluded.description,
    contact_phone = excluded.contact_phone,
    address = excluded.address,
    city_id = excluded.city_id;

  -- Survey responses (snapshot the prompt text).
  for r in select * from jsonb_array_elements(coalesce(p_responses, '[]'::jsonb))
  loop
    insert into public.seller_onboarding_responses (user_id, question_id, prompt_snapshot, answer)
    values (
      p_user_id,
      nullif(r ->> 'question_id', '')::uuid,
      (select prompt from public.onboarding_survey_questions q
        where q.id = nullif(r ->> 'question_id', '')::uuid),
      r -> 'answer'
    );
  end loop;

  -- Seller terms acceptance.
  insert into public.terms_acceptances (user_id, audience, version)
  values (p_user_id, 'SELLER', p_seller_terms_version);

  -- Promote the role (allowed because current_user = 'service_role').
  update public.profiles set role = 'SELLER' where id = p_user_id;
end;
$$;
