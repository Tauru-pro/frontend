-- seller-dashboard-commissions-settlements, 1.2: seller_profiles.segment_id —
-- the single normalized pointer used by every downstream commission
-- calculation (design.md Decision 1). Segment assignment is a deliberate
-- admin action (mirrors the existing document-verification workflow, 0023),
-- never a SELLER self-write, and never derived from onboarding survey
-- answers at read time.
--
-- design.md Decision 2: a seller cannot be verified (PENDING -> ACTIVE)
-- without a segment already assigned, closing the loop so that, by the time
-- a seller can publish products / receive orders, get_current_commission_rate
-- almost always has a real segment to resolve against. This guard applies
-- unconditionally — including to the service_role-driven auto-verification
-- in the seller-document-validate Edge Function (0023) — because the
-- invariant it protects (a verified, transacting seller always has a
-- segment) must hold regardless of which caller flips the status.

alter table public.seller_profiles
  add column if not exists segment_id uuid references public.seller_segments (id);

create index if not exists seller_profiles_segment_id_idx on public.seller_profiles (segment_id);

-- ---------------------------------------------------------------------------
-- Guard 1: a SELLER may never write their own segment_id (mirrors
-- protect_seller_profile_status's split for `status`, 0023's precedent).
-- service_role and ADMIN/SUPER_ADMIN bypass, same as that trigger.
-- ---------------------------------------------------------------------------
create or replace function public.protect_seller_profile_segment()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if (auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN') then
    return new;
  end if;

  if new.segment_id is distinct from old.segment_id then
    raise exception 'Only ADMIN/SUPER_ADMIN can change a seller''s segment';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_seller_profile_segment_trigger on public.seller_profiles;
create trigger protect_seller_profile_segment_trigger
  before update on public.seller_profiles
  for each row execute function public.protect_seller_profile_segment();

-- ---------------------------------------------------------------------------
-- Guard 2: PENDING -> ACTIVE is rejected while segment_id is null, for every
-- caller including service_role — this is a data-integrity invariant, not an
-- authorization rule, so there is no bypass.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_segment_before_verification()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'PENDING' and new.status = 'ACTIVE' and new.segment_id is null then
    raise exception 'SELLER_SEGMENT_REQUIRED'
      using hint = 'A seller must have a segment assigned before verification.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_segment_before_verification_trigger on public.seller_profiles;
create trigger enforce_segment_before_verification_trigger
  before update of status on public.seller_profiles
  for each row execute function public.enforce_segment_before_verification();

-- ---------------------------------------------------------------------------
-- assign_seller_segment: the one write path for segment assignment/reassignment.
-- SECURITY DEFINER so it can also perform the "both legal documents already
-- approved, seller still PENDING" completion check inline instead of
-- duplicating that logic in the Edge Function/Angular — same principle as
-- submit_seller_onboarding (0011) encapsulating a multi-step business rule
-- in one atomic function rather than several client-driven writes.
-- ---------------------------------------------------------------------------
create or replace function public.assign_seller_segment(
  p_seller_id uuid,
  p_segment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_all_required_approved boolean;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  update public.seller_profiles
  set segment_id = p_segment_id
  where id = p_seller_id
  returning status into v_current_status;

  if not found then
    raise exception 'SELLER_NOT_FOUND';
  end if;

  -- If both required legal documents are already approved and the seller is
  -- still PENDING solely because it previously had no segment, complete the
  -- verification now that Guard 2's condition is satisfied.
  if v_current_status = 'PENDING' then
    select
      count(*) filter (where doc_type = 'RUT' and status = 'APPROVED') = 1
      and count(*) filter (where doc_type = 'LEGAL_REP' and status = 'APPROVED') = 1
      into v_all_required_approved
    from public.seller_documents
    where seller_id = p_seller_id;

    if v_all_required_approved then
      update public.seller_profiles set status = 'ACTIVE' where id = p_seller_id;
    end if;
  end if;
end;
$$;

revoke all on function public.assign_seller_segment(uuid, uuid) from public;
grant execute on function public.assign_seller_segment(uuid, uuid) to authenticated;
