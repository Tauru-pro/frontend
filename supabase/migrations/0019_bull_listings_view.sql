-- The public catalog stops listing one card per straw and lists one per bull,
-- which is the unit a buyer actually chooses; the straw type is a variant of
-- that purchase. The home page already worked that way, so both surfaces now
-- read the same view and differ only by a filter.
--
-- `bull_listings` supersedes `featured_straws` (0018): same shape plus the
-- columns the catalog needs to paginate and filter server-side.
--   * is_featured        -> tells the two consumers apart
--   * breed_id           -> breed filter
--   * min_price/max_price-> "any straw within range" as an interval overlap:
--                           max_price >= :min AND min_price <= :max
--   * last_published_at  -> preserves the catalog's "newest first" ordering
--                           once rows are bulls rather than products
--
-- WARNING: like the view it replaces, this one reads past the RLS of its base
-- tables — its WHERE clause is the only barrier, and every column listed here
-- is public to anon. That is why the seller is reduced to `business_name`:
-- opening seller_profiles with a FOR SELECT policy would expose contact_phone
-- and address too, since a policy cannot restrict columns. Do not add columns
-- without re-reading this note.
--
-- The `p.status = 'ACTIVE'` join is also what keeps unapproved genetics out of
-- the catalog, and what makes a featured bull disappear on its own when the
-- administrator suspends its last approved straw.

create or replace view public.bull_listings as
select
  b.id                as bull_id,
  b.name              as bull_name,
  b.is_featured       as is_featured,
  br.id               as breed_id,
  br.name             as breed_name,
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
  )                   as straws
from public.bulls b
join public.products p
  on p.bull_id = b.id
 and p.status = 'ACTIVE'
join public.seller_profiles sp
  on sp.id = b.tenant_id
left join public.breeds br
  on br.id = b.breed_id
group by b.id, b.name, b.is_featured, br.id, br.name, sp.id, sp.business_name;

grant select on public.bull_listings to anon, authenticated;

-- Superseded: its only consumer moves to bull_listings in the same deploy.
-- Its definition stays in 0018 should it ever need recreating.
drop view if exists public.featured_straws;
