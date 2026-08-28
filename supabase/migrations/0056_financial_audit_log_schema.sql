-- seller-dashboard-commissions-settlements, 5.1/5.2: financial_audit_log —
-- one generic, append-only table for every auditable financial event
-- (design.md Decision 11), instead of seven near-identical per-entity audit
-- tables. Re-defines the write functions from earlier migrations in this
-- change (create or replace, same pattern 0045/0052 used to extend
-- apply_payment_approved) purely to add the audit insert — none of their
-- existing behavior changes.

create table if not exists public.financial_audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid,
  actor_type     text not null check (actor_type in ('ADMIN', 'SUPER_ADMIN', 'SYSTEM')),
  entity_type    text not null check (entity_type in (
                   'SEGMENT', 'COMMISSION_RULE', 'SELLER_SEGMENT', 'EARNING', 'SETTLEMENT'
                 )),
  entity_id      uuid not null,
  action         text not null,
  previous_value jsonb,
  new_value      jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);

create index if not exists financial_audit_log_entity_idx on public.financial_audit_log (entity_type, entity_id);
create index if not exists financial_audit_log_created_at_idx on public.financial_audit_log (created_at desc);

alter table public.financial_audit_log enable row level security;

create policy "financial_audit_log_select_admin" on public.financial_audit_log
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- No client-facing write policy — every insert happens inside the
-- SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------------
-- assign_seller_segment (0049): add SELLER_SEGMENT audit entry.
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
  v_previous_segment_id uuid;
  v_all_required_approved boolean;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  select segment_id into v_previous_segment_id from public.seller_profiles where id = p_seller_id;

  update public.seller_profiles
  set segment_id = p_segment_id
  where id = p_seller_id
  returning status into v_current_status;

  if not found then
    raise exception 'SELLER_NOT_FOUND';
  end if;

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, previous_value, new_value)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'SELLER_SEGMENT', p_seller_id, 'SEGMENT_ASSIGNED',
    jsonb_build_object('segment_id', v_previous_segment_id),
    jsonb_build_object('segment_id', p_segment_id)
  );

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

-- ---------------------------------------------------------------------------
-- schedule_commission_rule_change (0050): add COMMISSION_RULE audit entry.
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
  v_previous record;
begin
  if (auth.jwt() ->> 'user_role') <> 'SUPER_ADMIN' then
    raise exception 'FORBIDDEN';
  end if;

  select id, commission_rate into v_previous
  from public.seller_segment_commission_rules
  where segment_id = p_segment_id and active and effective_until is null and effective_from < p_effective_from;

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

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, previous_value, new_value)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'COMMISSION_RULE', v_new_id, 'COMMISSION_SCHEDULED',
    case when v_previous.id is not null
      then jsonb_build_object('rule_id', v_previous.id, 'commission_rate', v_previous.commission_rate)
      else null
    end,
    jsonb_build_object('segment_id', p_segment_id, 'commission_rate', p_commission_rate, 'effective_from', p_effective_from)
  );

  return v_new_id;
end;
$$;

revoke all on function public.schedule_commission_rule_change(uuid, numeric, timestamptz) from public;
grant execute on function public.schedule_commission_rule_change(uuid, numeric, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_earning_commission (0055): add EARNING audit entry.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_earning_commission(
  p_earning_id uuid,
  p_commission_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross integer;
  v_commission integer;
  v_status text;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  select gross_amount, status into v_gross, v_status
  from public.seller_earnings
  where id = p_earning_id and needs_commission_review;

  if not found then
    raise exception 'EARNING_NOT_FLAGGED';
  end if;

  v_commission := round(v_gross * p_commission_rate / 100);

  update public.seller_earnings
  set commission_rate = p_commission_rate,
      commission_amount = v_commission,
      seller_net_amount = v_gross - v_commission,
      needs_commission_review = false,
      status = case when v_status = 'PENDING' then 'AVAILABLE' else v_status end
  where id = p_earning_id;

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, previous_value, new_value)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'EARNING', p_earning_id, 'COMMISSION_RESOLVED',
    jsonb_build_object('commission_rate', 0, 'needs_commission_review', true),
    jsonb_build_object('commission_rate', p_commission_rate, 'commission_amount', v_commission)
  );
end;
$$;

revoke all on function public.resolve_earning_commission(uuid, numeric) from public;
grant execute on function public.resolve_earning_commission(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_seller_earning (0055): add EARNING audit entry.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_seller_earning(
  p_earning_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original record;
  v_reversal_id uuid;
begin
  if (auth.jwt() ->> 'user_role') not in ('ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_original from public.seller_earnings where id = p_earning_id;
  if not found then
    raise exception 'EARNING_NOT_FOUND';
  end if;
  if v_original.status = 'REVERSED' then
    raise exception 'ALREADY_REVERSED';
  end if;

  update public.seller_earnings set status = 'REVERSED' where id = p_earning_id;

  insert into public.seller_earnings (
    seller_id, order_id, payment_id, gross_amount,
    commission_rate, commission_amount, seller_net_amount,
    status, reversal_of_earning_id
  )
  values (
    v_original.seller_id, v_original.order_id, v_original.payment_id, -v_original.gross_amount,
    v_original.commission_rate, -v_original.commission_amount, -v_original.seller_net_amount,
    'AVAILABLE', p_earning_id
  )
  returning id into v_reversal_id;

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, previous_value, new_value, reason)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'EARNING', p_earning_id, 'EARNING_REVERSED',
    jsonb_build_object('status', v_original.status, 'seller_net_amount', v_original.seller_net_amount),
    jsonb_build_object('reversal_earning_id', v_reversal_id, 'seller_net_amount', -v_original.seller_net_amount),
    p_reason
  );

  return v_reversal_id;
end;
$$;

revoke all on function public.reverse_seller_earning(uuid, text) from public;
grant execute on function public.reverse_seller_earning(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_settlement / mark_settlement_paid / cancel_settlement (0054): add
-- SETTLEMENT audit entries.
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

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, new_value)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'SETTLEMENT', v_settlement_id, 'SETTLEMENT_CREATED',
    jsonb_build_object('status', 'PENDING', 'net_amount', v_net, 'earning_count', array_length(p_earning_ids, 1))
  );

  return v_settlement_id;
end;
$$;

revoke all on function public.create_settlement(uuid, uuid[], timestamptz, timestamptz, text) from public;
grant execute on function public.create_settlement(uuid, uuid[], timestamptz, timestamptz, text) to authenticated;

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

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, previous_value, new_value)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'SETTLEMENT', p_settlement_id, 'SETTLEMENT_PAID',
    jsonb_build_object('status', 'PENDING'), jsonb_build_object('status', 'PAID')
  );
end;
$$;

revoke all on function public.mark_settlement_paid(uuid) from public;
grant execute on function public.mark_settlement_paid(uuid) to authenticated;

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

  insert into public.financial_audit_log (actor_id, actor_type, entity_type, entity_id, action, new_value, reason)
  values (
    auth.uid(), (auth.jwt() ->> 'user_role'), 'SETTLEMENT', p_settlement_id, 'SETTLEMENT_CANCELLED',
    jsonb_build_object('status', 'CANCELLED'), p_reason
  );
end;
$$;

revoke all on function public.cancel_settlement(uuid, text) from public;
grant execute on function public.cancel_settlement(uuid, text) to authenticated;
