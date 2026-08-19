-- 0023_seller_verification_publishing rewrote `public_read_active_products`
-- (and `product_details`) so a product is only publicly visible when its
-- seller is verified (`seller_profiles.status = 'ACTIVE'`), not just when the
-- product itself is ACTIVE — but never applied the same condition to
-- `bull_listings`. Result: the Genética tab of the catalog kept listing bulls
-- from unverified sellers (this view reads past RLS, per the WARNING carried
-- since 0019), while `products`' own RLS correctly hid them the moment a
-- buyer tried to fetch the full product to add it to the cart — a 0-rows
-- PGRST116 on "Agregar", for every visitor regardless of auth state.
--
-- Fix: require the seller to be verified in the same join, matching
-- product_details exactly. No new columns, so no append-only concern this
-- time — just tightening the existing seller_profiles join.

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
 and sp.status = 'ACTIVE'
left join public.breeds br
  on br.id = b.breed_id
left join public.cities sc
  on sc.id = sp.city_id
left join public.states st
  on st.id = sc.state_id
group by b.id, b.name, b.is_featured, br.id, br.name, br.slug, sp.id, sp.business_name, st.id, st.name;

grant select on public.bull_listings to anon, authenticated;
