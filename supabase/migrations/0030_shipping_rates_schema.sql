-- Shipping rates ("tarifas de envío") were only ever modeled in the legacy
-- NestJS backend (`${environment.apiUrl}/shipping-rates`), same situation
-- pickup_points was in before 0028. checkout-orders-wompi needs this data in
-- Supabase so the create-checkout Edge Function can compute an authoritative
-- total without calling out to that other backend.
--
-- get_shipping_estimate() is the single source of truth for the shipping-cost
-- formula: both the buyer-facing checkout preview (RPC call from Angular) and
-- create-checkout (server-side authoritative total) call this same function,
-- so the two can never drift apart. It groups by seller (one shipping_rates
-- lookup per distinct seller in the cart, using that seller's main branch as
-- the origin), matching the shape the frontend's ShippingEstimateResponse /
-- Breakdown already expects (sellerId, sellerName, originState, shippingCost).

create table if not exists public.shipping_rates (
  id                    uuid primary key default gen_random_uuid(),
  origin_state_id       uuid not null references public.states (id),
  destination_state_id  uuid not null references public.states (id),
  base_rate             numeric(14,2) not null check (base_rate >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (origin_state_id, destination_state_id)
);

alter table public.shipping_rates enable row level security;

create policy "shipping_rates_select_all" on public.shipping_rates
  for select using (true);

create policy "shipping_rates_write_super_admin" on public.shipping_rates
  for insert with check ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "shipping_rates_update_super_admin" on public.shipping_rates
  for update using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

create policy "shipping_rates_delete_super_admin" on public.shipping_rates
  for delete using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');

drop trigger if exists shipping_rates_set_updated_at on public.shipping_rates;
create trigger shipping_rates_set_updated_at
  before update on public.shipping_rates
  for each row execute function public.set_updated_at();

-- p_items shape: [{ "product_id": "<uuid>", "quantity": <int> }, ...]
create or replace function public.get_shipping_estimate(
  p_pickup_point_id uuid,
  p_items jsonb
)
returns table (
  seller_id uuid,
  seller_name text,
  origin_state_id uuid,
  origin_state_name text,
  shipping_cost numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_destination_state_id uuid;
begin
  select st.id into v_destination_state_id
  from public.pickup_points pp
  join public.cities c on c.id = pp.city_id
  join public.states st on st.id = c.state_id
  where pp.id = p_pickup_point_id;

  if v_destination_state_id is null then
    raise exception 'PICKUP_POINT_NOT_FOUND';
  end if;

  return query
    select
      sp.id as seller_id,
      sp.business_name as seller_name,
      os.id as origin_state_id,
      os.name as origin_state_name,
      coalesce(sr.base_rate, 0) as shipping_cost
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity int)
    join public.products p on p.id = item.product_id
    join public.seller_profiles sp on sp.id = p.tenant_id
    join public.branches b on b.tenant_id = sp.id and b.is_main = true
    join public.cities oc on oc.id = b.city_id
    join public.states os on os.id = oc.state_id
    left join public.shipping_rates sr
      on sr.origin_state_id = os.id and sr.destination_state_id = v_destination_state_id
    group by sp.id, sp.business_name, os.id, os.name, sr.base_rate;
end;
$$;

revoke all on function public.get_shipping_estimate(uuid, jsonb) from public;
grant execute on function public.get_shipping_estimate(uuid, jsonb) to authenticated, anon, service_role;
