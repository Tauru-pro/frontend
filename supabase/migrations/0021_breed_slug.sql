-- Breeds gain a URL-safe slug so the public catalog filters by `?breed=gyr`
-- instead of leaking a uuid into a link people share.
--
-- The slug is derived by a trigger rather than by the client: the backoffice
-- form keeps sending just {name, purpose}, and renaming a breed recomputes the
-- slug on the spot, so the two can never drift apart.

alter table public.breeds
  add column if not exists slug text;

-- lowercase, unaccented, everything else collapsed into single dashes
create or replace function public.breed_slugify(p_name text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(
        coalesce(p_name, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

create or replace function public.set_breed_slug()
returns trigger
language plpgsql
as $$
begin
  new.slug := public.breed_slugify(new.name);
  return new;
end;
$$;

drop trigger if exists set_breed_slug on public.breeds;
create trigger set_breed_slug
  before insert or update of name on public.breeds
  for each row execute function public.set_breed_slug();

update public.breeds
   set slug = public.breed_slugify(name)
 where slug is null or slug = '';

alter table public.breeds
  alter column slug set not null;

-- Two different names can normalize to the same slug ("Gyr Lechero" vs
-- "gyr-lechero"); this raises 23505, the same duplicate error the unique on
-- `name` already produces, which the breed form handles.
create unique index if not exists breeds_slug_unique
  on public.breeds (slug);

-- ------------------------------------------- bull_listings gains breed_slug --

-- Dropped and recreated rather than replaced so `breed_slug` can sit next to
-- `breed_name`; CREATE OR REPLACE VIEW only allows appending at the end.
--
-- WARNING (carried over from 0019): this view reads past the RLS of its base
-- tables — the `p.status = 'ACTIVE'` join is the only barrier, and every column
-- listed here is public to anon. No seller field is exposed. Do not add columns
-- without re-reading this note.
drop view if exists public.bull_listings;

create view public.bull_listings as
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
  )                   as straws
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
