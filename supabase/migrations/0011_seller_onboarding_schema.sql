-- Seller self-onboarding: a segmentation survey defined by SUPER_ADMIN,
-- per-user responses, versioned terms documents + acceptances, and an atomic
-- promotion path CUSTOMER -> SELLER.
--
-- Role promotion cannot be done by the client: protect_role_and_status
-- (0004) only allows role changes from service_role or a SUPER_ADMIN JWT.
-- submit_seller_onboarding() below runs as SECURITY INVOKER and is granted
-- only to service_role, so the seller-self-onboard Edge Function (service_role)
-- can call it — current_user = 'service_role' satisfies the trigger — and all
-- writes happen in a single transaction.

-- ---------------------------------------------------------------------------
-- 1. Survey questions (managed by SUPER_ADMIN)
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_survey_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  input_type text not null check (input_type in ('SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT', 'NUMBER')),
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_survey_questions_position_idx
  on public.onboarding_survey_questions (position);

drop trigger if exists onboarding_survey_questions_set_updated_at on public.onboarding_survey_questions;
create trigger onboarding_survey_questions_set_updated_at
  before update on public.onboarding_survey_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Per-user survey responses (prompt snapshotted so later edits don't lose context)
-- ---------------------------------------------------------------------------
create table if not exists public.seller_onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid references public.onboarding_survey_questions (id) on delete set null,
  prompt_snapshot text,
  answer jsonb,
  created_at timestamptz not null default now()
);

create index if not exists seller_onboarding_responses_user_id_idx
  on public.seller_onboarding_responses (user_id);

-- ---------------------------------------------------------------------------
-- 3. Terms documents + acceptances (BUYER at sign-up, SELLER at onboarding)
-- ---------------------------------------------------------------------------
create table if not exists public.terms_documents (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('BUYER', 'SELLER')),
  version text not null,
  content text not null,
  is_current boolean not null default true,
  published_at timestamptz not null default now()
);

-- At most one current document per audience.
create unique index if not exists terms_documents_current_per_audience_idx
  on public.terms_documents (audience) where is_current;

create table if not exists public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  audience text not null check (audience in ('BUYER', 'SELLER')),
  version text not null,
  accepted_at timestamptz not null default now()
);

create index if not exists terms_acceptances_user_id_idx
  on public.terms_acceptances (user_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.onboarding_survey_questions enable row level security;
alter table public.seller_onboarding_responses enable row level security;
alter table public.terms_documents enable row level security;
alter table public.terms_acceptances enable row level security;

-- Questions: any authenticated user can read (to render the wizard); only SUPER_ADMIN writes.
create policy "survey_questions_select_auth" on public.onboarding_survey_questions
  for select to authenticated using (true);
create policy "survey_questions_all_super_admin" on public.onboarding_survey_questions
  for all using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN')
  with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

-- Responses: owner reads own; ADMIN/SUPER_ADMIN read all. Inserts happen via
-- service_role inside submit_seller_onboarding() (no client INSERT policy).
create policy "onboarding_responses_select_own" on public.seller_onboarding_responses
  for select using (auth.uid() = user_id);
create policy "onboarding_responses_select_admin" on public.seller_onboarding_responses
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- Terms documents: readable by anyone (sign-up shows buyer terms before a
-- session exists); only SUPER_ADMIN writes.
create policy "terms_documents_select_all" on public.terms_documents
  for select using (true);
create policy "terms_documents_all_super_admin" on public.terms_documents
  for all using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN')
  with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

-- Acceptances: owner reads own; ADMIN/SUPER_ADMIN read all. BUYER rows are
-- inserted by handle_new_user (SECURITY DEFINER); SELLER rows by
-- submit_seller_onboarding (service_role). No client INSERT policy needed.
create policy "terms_acceptances_select_own" on public.terms_acceptances
  for select using (auth.uid() = user_id);
create policy "terms_acceptances_select_admin" on public.terms_acceptances
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- ---------------------------------------------------------------------------
-- 5. Record buyer terms acceptance at account creation
-- ---------------------------------------------------------------------------
-- There is no session immediately after signUp (email confirmation pending),
-- so the client cannot insert the buyer acceptance itself. Instead the sign-up
-- passes buyer_terms_version in user metadata and this SECURITY DEFINER trigger
-- records it atomically with the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    'CUSTOMER'
  );

  if new.raw_user_meta_data ? 'buyer_terms_version' then
    insert into public.terms_acceptances (user_id, audience, version)
    values (new.id, 'BUYER', new.raw_user_meta_data ->> 'buyer_terms_version');
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Atomic CUSTOMER -> SELLER promotion (called by the Edge Function as service_role)
-- ---------------------------------------------------------------------------
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
    user_id, business_name, description, contact_phone, country, address, city_id, business_hours, status
  )
  values (
    p_user_id,
    p_company ->> 'business_name',
    p_company ->> 'description',
    p_company ->> 'contact_phone',
    coalesce(nullif(p_company ->> 'country', ''), 'Colombia'),
    p_company ->> 'address',
    nullif(p_company ->> 'city_id', '')::uuid,
    p_company ->> 'business_hours',
    'PENDING'
  )
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    description = excluded.description,
    contact_phone = excluded.contact_phone,
    country = excluded.country,
    address = excluded.address,
    city_id = excluded.city_id,
    business_hours = excluded.business_hours;

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

revoke execute on function public.submit_seller_onboarding(uuid, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_seller_onboarding(uuid, jsonb, jsonb, text)
  to service_role;
