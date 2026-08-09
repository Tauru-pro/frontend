-- The product detail page shows who sells the product, so `product_details`
-- gains the seller's store name.
--
-- The join goes through `p.tenant_id`, not the bull's, so supplies — which have
-- no bull — also carry their seller.
--
-- WARNING (carried over from 0020): this view reads past the RLS of its base
-- tables — the `p.status = 'ACTIVE'` predicate is the only barrier, and every
-- column listed here is public to anon. Only `business_name` is taken from
-- seller_profiles; opening that table with a FOR SELECT policy would expose
-- contact_phone and address too, since a policy cannot restrict columns. Do not
-- add columns without re-reading this note.

-- Dropped and recreated rather than replaced: CREATE OR REPLACE VIEW only
-- allows appending columns at the end, and the seller belongs next to the bull.
drop view if exists public.product_details;

create view public.product_details as
select
  p.id   as product_id,
  b.id   as bull_id,
  b.name as bull_name,
  br.name as breed_name,
  sp.id            as seller_id,
  sp.business_name as seller_name,

  -- Video and genetic test PDF of the bull; empty array for supplies.
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'id',           m.id,
                 'entity_type',  m.entity_type,
                 'entity_id',    m.entity_id,
                 'media_type',   m.media_type,
                 'storage_path', m.storage_path,
                 'mime_type',    m.mime_type,
                 'sort_order',   m.sort_order,
                 'is_cover',     m.is_cover,
                 'created_at',   m.created_at
               )
               order by m.sort_order asc nulls last, m.created_at asc
             )
        from public.product_media m
       where m.entity_type = 'bull'
         and m.entity_id = b.id
    ),
    '[]'::jsonb
  ) as bull_media,

  -- The buyable variants. For a straw: every approved straw of its bull. For a
  -- supply: just itself. Full product fields on purpose — the cart persists the
  -- whole Product and repaints it in /carrito, so a reduced shape would force
  -- an extra request on "add to cart".
  (
    select jsonb_agg(
             jsonb_build_object(
               'id',                 v.id,
               'tenant_id',          v.tenant_id,
               'product_type',       v.product_type,
               'name',               v.name,
               'slug',               v.slug,
               'description',        v.description,
               'price',              v.price,
               'bull_id',            v.bull_id,
               'straw_type',         v.straw_type,
               'min_order_quantity', v.min_order_quantity,
               'stock_quantity',     v.stock_quantity,
               'status',             v.status,
               'created_at',         v.created_at,
               'updated_at',         v.updated_at,
               'media', coalesce(
                 (
                   select jsonb_agg(
                            jsonb_build_object(
                              'id',           m.id,
                              'entity_type',  m.entity_type,
                              'entity_id',    m.entity_id,
                              'media_type',   m.media_type,
                              'storage_path', m.storage_path,
                              'mime_type',    m.mime_type,
                              'sort_order',   m.sort_order,
                              'is_cover',     m.is_cover,
                              'created_at',   m.created_at
                            )
                            order by m.is_cover desc, m.sort_order asc nulls last
                          )
                     from public.product_media m
                    where m.entity_type = 'product'
                      and m.entity_id = v.id
                 ),
                 '[]'::jsonb
               )
             )
             order by v.price asc
           )
      from public.products v
     where v.status = 'ACTIVE'
       and (
         (p.bull_id is not null and v.bull_id = p.bull_id and v.product_type = 'STRAW')
         or
         (p.bull_id is null and v.id = p.id)
       )
  ) as variants

from public.products p
left join public.bulls  b  on b.id = p.bull_id
left join public.breeds br on br.id = b.breed_id
join public.seller_profiles sp on sp.id = p.tenant_id
where p.status = 'ACTIVE';

grant select on public.product_details to anon, authenticated;
