-- seller-order-management, 2.3: the only write path to
-- order_seller_fulfillments (design.md Decision 5) — the table itself has
-- no client-facing insert/update/delete policy at all, so a direct
-- supabase.from('order_seller_fulfillments').update(...) is rejected by RLS
-- even if attempted, independent of this function existing.
--
-- Conflict-safety: the fulfillment row is locked with SELECT ... FOR UPDATE,
-- so two concurrent transition attempts on the same record serialize — the
-- second blocks until the first commits, then re-reads the now-updated
-- status and correctly fails its own transition check, returning false
-- (never an exception) so the caller can map that to 409 Conflict.

create or replace function public.update_order_fulfillment_status(
  p_order_id uuid,
  p_new_status text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_fulfillment record;
  v_from_status text;
  v_allowed boolean;
begin
  select id into v_seller_id from public.seller_profiles where user_id = auth.uid();
  if v_seller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_new_status not in ('PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED') then
    raise exception 'INVALID_STATUS: %', p_new_status;
  end if;

  if p_new_status = 'CANCELLED' and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_fulfillment
  from public.order_seller_fulfillments
  where order_id = p_order_id and seller_id = v_seller_id
  for update;

  if not found then
    raise exception 'FULFILLMENT_NOT_FOUND';
  end if;

  v_from_status := v_fulfillment.status;

  -- Transition graph (design.md Decision 2/5): RECEIVED -> PROCESSING ->
  -- SHIPPED -> COMPLETED; CANCELLED reachable only from RECEIVED or
  -- PROCESSING, never from SHIPPED/COMPLETED.
  v_allowed := case
    when p_new_status = 'PROCESSING' then v_from_status = 'RECEIVED'
    when p_new_status = 'SHIPPED' then v_from_status = 'PROCESSING'
    when p_new_status = 'COMPLETED' then v_from_status = 'SHIPPED'
    when p_new_status = 'CANCELLED' then v_from_status in ('RECEIVED', 'PROCESSING')
    else false
  end;

  if not v_allowed then
    return false;
  end if;

  update public.order_seller_fulfillments
  set status = p_new_status,
      cancelled_reason = case when p_new_status = 'CANCELLED' then p_reason else cancelled_reason end
  where id = v_fulfillment.id;

  insert into public.order_fulfillment_history (
    fulfillment_id, order_id, seller_id, from_status, to_status, actor_type, actor_id, reason
  )
  values (
    v_fulfillment.id, p_order_id, v_seller_id, v_from_status, p_new_status, 'SELLER', auth.uid(), p_reason
  );

  return true;
end;
$$;

revoke all on function public.update_order_fulfillment_status(uuid, text, text) from public;
grant execute on function public.update_order_fulfillment_status(uuid, text, text) to authenticated;
