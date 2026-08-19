-- Catalog needs to filter genetics by the seller's department (e.g. "toros
-- en Córdoba"), but `bull_listings` never exposed seller location — it only
-- reduces `seller_profiles` to `business_name` (see the WARNING in 0019).
-- Department is reachable via seller_profiles.city_id -> cities.state_id ->
-- states, and both `cities`/`states` are public-read tables (0008), so this
-- doesn't change what's exposed, only adds two more hops of already-public
-- reference data.
--
-- Appended at the end of the select list, same lesson as 0024: CREATE OR
-- REPLACE VIEW only allows adding columns at the end, or it errors with
-- "cannot change name of view column".
--
-- Left joins throughout: a seller without a city_id set (or a city not yet
-- linked to a state) must still show their bulls, just without a department.
--
-- WARNING (carried over from 0019/0021/0024): this view reads past the RLS
-- of its base tables — the `p.status = 'ACTIVE'` join is the only barrier,
-- and every column listed here is public to anon. Do not add columns
-- without re-reading this note.

create or replace view public.bull_listings as
select
  b.id                as bull_id,
  b.name              as bull_name,
  b.is_featured       as is_featured,
  br.id               as breed_id,
  br.name             as breed_name,
  br.slug             as breed_slug,
  sp.id               as seller_id,
  sp.business_name    as seller_name,
  (
    select m.storage_path
      from public.product_media m
     where m.entity_type = 'bull'
       and m.entity_id = b.id
       and m.media_type = 'image'
     order by m.is_cover desc, m.sort_order asc nulls last
     limit 1
  )                   as cover_path,
  min(p.price)        as min_price,
  max(p.price)        as max_price,
  max(p.created_at)   as last_published_at,
  jsonb_agg(
    jsonb_build_object(
      'id',                 p.id,
      'name',               p.name,
      'straw_type',         p.straw_type,
      'price',              p.price,
      'min_order_quantity', p.min_order_quantity,
      'stock_quantity',     p.stock_quantity
    )
    order by p.price asc
  )                   as straws,
  b.short_code        as bull_short_code,
  st.id               as seller_state_id,
  st.name             as seller_state_name
from public.bulls b
join public.products p
  on p.bull_id = b.id
 and p.status = 'ACTIVE'
join public.seller_profiles sp
  on sp.id = b.tenant_id
left join public.breeds br
  on br.id = b.breed_id
left join public.cities sc
  on sc.id = sp.city_id
left join public.states st
  on st.id = sc.state_id
group by b.id, b.name, b.is_featured, br.id, br.name, br.slug, sp.id, sp.business_name, st.id, st.name;

grant select on public.bull_listings to anon, authenticated;
