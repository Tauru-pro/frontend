-- Phone numbers split into dial code + national number.
--
-- Until now every phone field was a single free-text column and the country
-- code, if present at all, was buried inside it. The shared phone input now
-- asks for the country explicitly, so each phone column gains a sibling that
-- holds the dial code in `+57` form while the original column keeps only the
-- national number.
--
-- The backfill assumes Colombia for values with no `+` prefix: the marketplace
-- was Colombia-only until the worldwide geography catalog landed in 0016.

alter table public.customer_profiles
  add column if not exists phone_country_code    text,
  add column if not exists whatsapp_country_code text;

alter table public.seller_profiles
  add column if not exists contact_phone_country_code text;

alter table public.branches
  add column if not exists phone_country_code text;

-- ---------------------------------------------------------------- backfill --

-- Normalizes what humans type: drops spaces, dashes, dots and parentheses,
-- keeping a leading '+' when there was one.
create or replace function public.phone_compact(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    else regexp_replace(btrim(p_phone), '[\s\-\(\)\.]', '', 'g')
  end;
$$;

-- The dial code of a stored phone, in '+57' form.
--
-- The country match is greedy on purpose: dial codes run from 1 to 4 digits and
-- some are prefixes of others (+1 vs +1242, +7 vs +76), so the longest match
-- must win or every Bahamian number would be filed under the USA. A value that
-- does not start with '+' is taken verbatim as a national number under +57 — a
-- value like '57300...' keeps its embedded country digits rather than being
-- mangled by a guess, which is the safer failure.
create or replace function public.phone_dial_code(p_phone text)
returns text
language sql
stable
as $$
  select case
    when public.phone_compact(p_phone) is null then null
    when left(public.phone_compact(p_phone), 1) <> '+' then '+57'
    else coalesce(
      (select '+' || c.phonecode
         from public.countries c
        where c.phonecode is not null
          and c.phonecode <> ''
          and substring(public.phone_compact(p_phone) from 2) like c.phonecode || '%'
        order by length(c.phonecode) desc, c.name asc
        limit 1),
      '+57')
  end;
$$;

-- The national part of a stored phone, with the matched dial code removed.
create or replace function public.phone_national(p_phone text)
returns text
language sql
stable
as $$
  select case
    when public.phone_compact(p_phone) is null then null
    when left(public.phone_compact(p_phone), 1) <> '+' then public.phone_compact(p_phone)
    else coalesce(
      (select substring(substring(public.phone_compact(p_phone) from 2)
                        from length(c.phonecode) + 1)
         from public.countries c
        where c.phonecode is not null
          and c.phonecode <> ''
          and substring(public.phone_compact(p_phone) from 2) like c.phonecode || '%'
        order by length(c.phonecode) desc, c.name asc
        limit 1),
      -- Unknown prefix: keep every digit rather than lose one.
      substring(public.phone_compact(p_phone) from 2))
  end;
$$;

-- Both expressions read the pre-update value of the phone column, so assigning
-- the code and the number in one statement is safe.
update public.customer_profiles
set phone_country_code = public.phone_dial_code(phone),
    phone              = public.phone_national(phone)
where phone is not null and btrim(phone) <> '';

update public.customer_profiles
set whatsapp_country_code = public.phone_dial_code(whatsapp),
    whatsapp              = public.phone_national(whatsapp)
where whatsapp is not null and btrim(whatsapp) <> '';

update public.seller_profiles
set contact_phone_country_code = public.phone_dial_code(contact_phone),
    contact_phone              = public.phone_national(contact_phone)
where contact_phone is not null and btrim(contact_phone) <> '';

update public.branches
set phone_country_code = public.phone_dial_code(phone),
    phone              = public.phone_national(phone)
where phone is not null and btrim(phone) <> '';

-- "No phone" must be a single state, not two: never leave a dial code stranded
-- on a row whose number ended up empty.
update public.customer_profiles set phone_country_code = null
  where phone is null or btrim(phone) = '';
update public.customer_profiles set whatsapp_country_code = null
  where whatsapp is null or btrim(whatsapp) = '';
update public.seller_profiles set contact_phone_country_code = null
  where contact_phone is null or btrim(contact_phone) = '';
update public.branches set phone_country_code = null
  where phone is null or btrim(phone) = '';

drop function if exists public.phone_national(text);
drop function if exists public.phone_dial_code(text);
drop function if exists public.phone_compact(text);

-- ------------------------------------------------- seller onboarding RPC ----

-- Same body as 0012, with the contact phone's dial code read out of the
-- p_company jsonb. The signature is unchanged: the jsonb is the extension point.
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
    user_id, business_name, description, contact_phone, contact_phone_country_code,
    address, city_id, status
  )
  values (
    p_user_id,
    p_company ->> 'business_name',
    p_company ->> 'description',
    p_company ->> 'contact_phone',
    nullif(p_company ->> 'contact_phone_country_code', ''),
    p_company ->> 'address',
    nullif(p_company ->> 'city_id', '')::uuid,
    'PENDING'
  )
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    description = excluded.description,
    contact_phone = excluded.contact_phone,
    contact_phone_country_code = excluded.contact_phone_country_code,
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

-- Rollback note: this migration strips the '+' prefix from numbers that had one
-- embedded. To restore the original single-column values, run this before
-- reverting the frontend:
--
--   update public.customer_profiles set phone = coalesce(phone_country_code, '') || phone where phone is not null;
--   update public.customer_profiles set whatsapp = coalesce(whatsapp_country_code, '') || whatsapp where whatsapp is not null;
--   update public.seller_profiles set contact_phone = coalesce(contact_phone_country_code, '') || contact_phone where contact_phone is not null;
--   update public.branches set phone = coalesce(phone_country_code, '') || phone where phone is not null;
