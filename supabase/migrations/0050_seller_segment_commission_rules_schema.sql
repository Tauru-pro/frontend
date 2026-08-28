-- seller-dashboard-commissions-settlements, 2.1/2.2: seller_segment_commission_rules
-- — time-versioned commission percentage per segment (design.md Decisions 3/4).
-- commission_rate is a whole percentage (25.00 = 25%), never a fraction
-- (proposal §7). The exclusion constraint is the database-enforced guarantee
-- that at most one active rule ever covers a given instant for a segment —
-- an application-level "check then insert" would have the same TOCTOU race
-- this codebase already guards against elsewhere (create_order_with_items).

create extension if not exists btree_gist;

create table if not exists public.seller_segment_commission_rules (
  id               uuid primary key default gen_random_uuid(),
  segment_id       uuid not null references public.seller_segments (id),
  commission_rate  numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  active           boolean not null default true,
  effective_from   timestamptz not null default now(),
  effective_until  timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);

create index if not exists commission_rules_segment_id_idx on public.seller_segment_commission_rules (segment_id);

drop trigger if exists commission_rules_set_updated_at on public.seller_segment_commission_rules;
create trigger commission_rules_set_updated_at
  before update on public.seller_segment_commission_rules
  for each row execute function public.set_updated_at();

-- At most one ACTIVE rule per segment may cover any given instant.
alter table public.seller_segment_commission_rules
  add constraint no_overlapping_active_rules
  exclude using gist (
    segment_id with =,
    tstzrange(effective_from, coalesce(effective_until, 'infinity'), '[)') with &&
  ) where (active);

alter table public.seller_segment_commission_rules enable row level security;

create policy "commission_rules_select_auth" on public.seller_segment_commission_rules
  for select to authenticated using (true);

create policy "commission_rules_all_super_admin" on public.seller_segment_commission_rules
  for all using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN')
  with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

-- Seed the initial rules (proposal §9/§38). effective_from = now() at
-- migration time; these remain fully editable from the admin panel afterward.
insert into public.seller_segment_commission_rules (segment_id, commission_rate, active, effective_from)
select id, 25.00, true, now() from public.seller_segments where code = 'DISTRIBUTOR'
union all
select id, 25.00, true, now() from public.seller_segments where code = 'LABORATORY'
union all
select id, 30.00, true, now() from public.seller_segments where code = 'LIVESTOCK_COMPANY';

-- ---------------------------------------------------------------------------
-- get_current_commission_rate: single source of truth for "what rate applies
-- to this segment right now / at this past instant" (design.md Decision 4).
-- Returns null (not an error) when no active rule covers p_at — callers
-- (apply_payment_approved, 0052) treat that as "needs commission review",
-- never as a reason to fail (design.md Decision 7).
-- ---------------------------------------------------------------------------
create or replace function public.get_current_commission_rate(
  p_segment_id uuid,
  p_at timestamptz default now()
)
returns numeric
language sql
stable
as $$
  select commission_rate
  from public.seller_segment_commission_rules
  where segment_id = p_segment_id
    and active
    and effective_from <= p_at
    and (effective_until is null or effective_until > p_at)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- schedule_commission_rule_change: the one write path for changing a
-- segment's commission (design.md/proposal §8 — history-preserving, no
-- overlap). Closes whichever active rule currently has no effective_until
-- (the "open-ended" current rule) at p_effective_from, then inserts the new
-- rule starting there — both in one transaction, so the exclusion
-- constraint never sees a transient overlap from two separate client calls.
-- ---------------------------------------------------------------------------
create or replace function public.schedule_commission_rule_change(
  p_segment_id uuid,
  p_commission_rate numeric,
  p_effective_from timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  if (auth.jwt() ->> 'user_role') <> 'SUPER_ADMIN' then
    raise exception 'FORBIDDEN';
  end if;

  update public.seller_segment_commission_rules
  set effective_until = p_effective_from
  where segment_id = p_segment_id
    and active
    and effective_until is null
    and effective_from < p_effective_from;

  insert into public.seller_segment_commission_rules (
    segment_id, commission_rate, active, effective_from, created_by
  )
  values (p_segment_id, p_commission_rate, true, p_effective_from, auth.uid())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.schedule_commission_rule_change(uuid, numeric, timestamptz) from public;
grant execute on function public.schedule_commission_rule_change(uuid, numeric, timestamptz) to authenticated;
