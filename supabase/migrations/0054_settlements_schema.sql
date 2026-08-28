-- seller-dashboard-commissions-settlements, 4.1/4.2/4.3/4.4: settlements +
-- settlement_items, and the three admin-only functions that move earnings
-- through them. create_settlement uses a conditional UPDATE ... WHERE
-- status = 'AVAILABLE' claim (design.md Decision 9) — the same
-- "conditional UPDATE, check row count/`found`" pattern already used by
-- apply_payment_approved/update_order_fulfillment_status — so two
-- concurrent settlement-creation calls can never both claim the same
-- earning (proposal §27).

create table if not exists public.settlements (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.seller_profiles (id),
  settlement_number  text not null unique,
  gross_amount       integer not null default 0,
  commission_amount  integer not null default 0,
  net_amount         integer not null default 0,
  status             text not null default 'DRAFT' check (status in (
                       'DRAFT', 'PENDING', 'PROCESSING', 'PAID', 'CANCELLED', 'FAILED'
                     )),
  period_start       timestamptz,
  period_end         timestamptz,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz,
  created_by         uuid references public.profiles (id),
  notes              text
);

create index if not exists settlements_seller_id_idx on public.settlements (seller_id);

alter table public.settlements enable row level security;

create policy "settlements_select_own" on public.settlements
  for select using (
    seller_id = (select id from public.seller_profiles where user_id = auth.uid())
  );

create policy "settlements_select_admin" on public.settlements
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- No client-facing insert/update/delete policy — all writes go through the
-- SECURITY DEFINER functions below.

alter publication supabase_realtime add table public.settlements;

create table if not exists public.settlement_items (
  id                uuid primary key default gen_random_uuid(),
  settlement_id     uuid not null references public.settlements (id) on delete cascade,
  seller_earning_id uuid not null references public.seller_earnings (id),
  created_at        timestamptz not null default now(),
  -- Only prevents the same earning being listed twice within one settlement.
  -- Exclusivity across settlements (an earning claimed by at most one
  -- non-cancelled settlement at a time) is enforced by seller_earnings.status
  -- via create_settlement's conditional claim, not by a constraint here — a
  -- cancelled settlement's earning legitimately returns to AVAILABLE and can
  -- be claimed by a later settlement, which would otherwise collide with a
  -- naive per-earning unique index.
  unique (settlement_id, seller_earning_id)
);

create index if not exists settlement_items_settlement_id_idx on public.settlement_items (settlement_id);

alter table public.settlement_items enable row level security;

create policy "settlement_items_select_own" on public.settlement_items
  for select using (
    exists (
      select 1 from public.settlements s
      where s.id = settlement_items.settlement_id
        and s.seller_id = (select id from public.seller_profiles where user_id = auth.uid())
    )
  );

create policy "settlement_items_select_admin" on public.settlement_items
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- ---------------------------------------------------------------------------
-- create_settlement: the one write path for grouping AVAILABLE earnings into
-- a new settlement. The UPDATE ... WHERE status = 'AVAILABLE' claim is what
-- makes this race-safe (design.md Decision 9) — if any requested earning
-- isn't actually claimable anymore, the whole transaction rolls back rather
-- than settling a silently-partial set.
-- ---------------------------------------------------------------------------
create or replace function public.create_settlement(
  p_seller_id uuid,
  p_earning_ids uuid[],
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed_count int;
  v_gross integer;
  v_commission integer;
  v_net integer;
  v_settlement_id uuid;
  v_settlement_number text;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  if p_earning_ids is null or array_length(p_earning_ids, 1) is null then
    raise exception 'EMPTY_SELECTION';
  end if;

  update public.seller_earnings
  set status = 'IN_SETTLEMENT'
  where id = any(p_earning_ids)
    and seller_id = p_seller_id
    and status = 'AVAILABLE';
  get diagnostics v_claimed_count = row_count;

  if v_claimed_count <> array_length(p_earning_ids, 1) then
    raise exception 'EARNING_ALREADY_CLAIMED'
      using hint = 'One or more selected earnings are no longer AVAILABLE. Refresh and try again.';
  end if;

  select coalesce(sum(gross_amount), 0), coalesce(sum(commission_amount), 0), coalesce(sum(seller_net_amount), 0)
    into v_gross, v_commission, v_net
  from public.seller_earnings
  where id = any(p_earning_ids);

  v_settlement_number := 'STL-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.settlements (
    seller_id, settlement_number, gross_amount, commission_amount, net_amount,
    status, period_start, period_end, created_by, notes
  )
  values (
    p_seller_id, v_settlement_number, v_gross, v_commission, v_net,
    'PENDING', p_period_start, p_period_end, auth.uid(), p_notes
  )
  returning id into v_settlement_id;

  insert into public.settlement_items (settlement_id, seller_earning_id)
  select v_settlement_id, unnest(p_earning_ids);

  return v_settlement_id;
end;
$$;

revoke all on function public.create_settlement(uuid, uuid[], timestamptz, timestamptz, text) from public;
grant execute on function public.create_settlement(uuid, uuid[], timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_settlement_paid: atomically finalizes a settlement and its earnings.
-- ---------------------------------------------------------------------------
create or replace function public.mark_settlement_paid(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  update public.settlements
  set status = 'PAID', processed_at = now()
  where id = p_settlement_id and status in ('PENDING', 'PROCESSING');

  if not found then
    raise exception 'SETTLEMENT_NOT_PAYABLE';
  end if;

  update public.seller_earnings
  set status = 'SETTLED'
  where status = 'IN_SETTLEMENT'
    and id in (select seller_earning_id from public.settlement_items where settlement_id = p_settlement_id);
end;
$$;

revoke all on function public.mark_settlement_paid(uuid) from public;
grant execute on function public.mark_settlement_paid(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_settlement: only for non-PAID settlements; releases earnings back
-- to AVAILABLE so they can be included in a future settlement.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_settlement(p_settlement_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  update public.settlements
  set status = 'CANCELLED', notes = coalesce(p_reason, notes)
  where id = p_settlement_id and status <> 'PAID';

  if not found then
    raise exception 'SETTLEMENT_NOT_CANCELLABLE';
  end if;

  update public.seller_earnings
  set status = 'AVAILABLE'
  where status = 'IN_SETTLEMENT'
    and id in (select seller_earning_id from public.settlement_items where settlement_id = p_settlement_id);
end;
$$;

revoke all on function public.cancel_settlement(uuid, text) from public;
grant execute on function public.cancel_settlement(uuid, text) to authenticated;
