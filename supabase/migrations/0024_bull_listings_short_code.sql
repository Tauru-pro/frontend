-- The catalog search box needs to match a bull by its short code (e.g.
-- "117/2"), not just its name, but `bull_listings` (0019, extended in 0021)
-- never exposed `short_code`. It's already public today via `PRODUCT_SELECT`
-- in product.service.ts (product detail page, admin review), so surfacing it
-- here doesn't change what's exposed to anon, only where it's available.
--
-- Appended at the end of the select list rather than dropping/recreating the
-- view (like 0021 did to place breed_slug next to breed_name): CREATE OR
-- REPLACE VIEW only allows adding columns at the end, which is fine here.
--
-- WARNING (carried over from 0019/0021): this view reads past the RLS of its
-- base tables — the `p.status = 'ACTIVE'` join is the only barrier, and every
-- column listed here is public to anon. Do not add columns without re-reading
-- this note.

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
  b.short_code        as bull_short_code
from public.bulls b
join public.products p
  on p.bull_id = b.id
 and p.status = 'ACTIVE'
join public.seller_profiles sp
  on sp.id = b.tenant_id
left join public.breeds br
  on br.id = b.breed_id
group by b.id, b.name, b.is_featured, br.id, br.name, br.slug, sp.id, sp.business_name;

grant select on public.bull_listings to anon, authenticated;
