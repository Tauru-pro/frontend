-- Everything the public product detail page needs, in one row.
--
-- The page used to make three requests: the product (with its bull), its media,
-- and its sibling straws. Two of those exist only because `product_media` is
-- polymorphic — `entity_id` is a bare uuid pointing at either `bulls` or
-- `products`, with no foreign key — so PostgREST cannot embed it and answers
-- `PGRST200` to `products?select=...,product_media(...)`. Aggregating the media
-- here as jsonb is what collapses the three into one.
--
-- One row per ACTIVE product, keyed by `product_id`. Each row carries *all* the
-- approved straws of the same bull, each with its own media, so switching straw
-- type on the page costs no request at all.
--
-- Supplies come through the same path: `left join` on bulls, and `variants`
-- holds the product itself when there is no bull. The page therefore has a
-- single branch — it always looks up the route's product_id inside `variants`.
--
-- WARNING: like `bull_listings` and the view before it, this one reads past the
-- RLS of its base tables — the `p.status = 'ACTIVE'` predicate is the only
-- barrier, and every column listed here is public to anon. No seller field is
-- exposed. Do not add columns without re-reading this note.

create or replace view public.product_details as
select
  p.id   as product_id,
  b.id   as bull_id,
  b.name as bull_name,
  br.name as breed_name,

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
         -- straws: the siblings of the same bull; supplies: only itself
         (p.bull_id is not null and v.bull_id = p.bull_id and v.product_type = 'STRAW')
         or
         (p.bull_id is null and v.id = p.id)
       )
  ) as variants

from public.products p
left join public.bulls  b  on b.id = p.bull_id
left join public.breeds br on br.id = b.breed_id
where p.status = 'ACTIVE';

grant select on public.product_details to anon, authenticated;
