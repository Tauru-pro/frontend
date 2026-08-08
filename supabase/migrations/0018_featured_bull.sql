-- Featured bull: a seller may spotlight one of their bulls on the marketplace
-- home page, but only once the administrator has approved at least one of its
-- straws.
--
-- Both halves of that rule are enforced here rather than in the UI, because
-- `seller_own_bulls` is a FOR ALL policy: a seller can PATCH any column of their
-- own bulls straight through PostgREST, `is_featured` included.
--   * "only one"     -> partial unique index on (tenant_id) where is_featured
--   * "only approved" -> before-trigger checking for an ACTIVE straw

alter table public.bulls
  add column if not exists is_featured boolean not null default false;

-- Two rows of the same tenant with is_featured = true become impossible,
-- whatever writes them.
create unique index if not exists bulls_one_featured_per_tenant
  on public.bulls (tenant_id) where is_featured;

-- ------------------------------------------------- approval enforcement -----

create or replace function public.enforce_featured_bull_approved()
returns trigger
language plpgsql
as $$
begin
  if new.is_featured and not exists (
    select 1 from public.products p
     where p.bull_id = new.id
       and p.status = 'ACTIVE'
  ) then
    raise exception 'BULL_NOT_APPROVED'
      using hint = 'The bull needs at least one ACTIVE straw before it can be featured.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_featured_bull_approved on public.bulls;
create trigger enforce_featured_bull_approved
  before insert or update of is_featured on public.bulls
  for each row execute function public.enforce_featured_bull_approved();

-- ---------------------------------------------------------- swap the mark ---

-- Switching the featured bull as two client-side updates would either trip the
-- unique index (if the new one is set first) or leave the seller with none (if
-- the second call fails). One transaction, one call.
create or replace function public.set_featured_bull(p_bull_id uuid, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_caller_tenant uuid;
begin
  select tenant_id into v_tenant_id from public.bulls where id = p_bull_id;
  if v_tenant_id is null then
    raise exception 'BULL_NOT_FOUND';
  end if;

  -- security definer bypasses RLS, so ownership is checked explicitly.
  v_caller_tenant := nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
  if v_caller_tenant is distinct from v_tenant_id then
    raise exception 'NOT_BULL_OWNER';
  end if;

  -- Clear first: the unique index only tolerates one true per tenant.
  update public.bulls
     set is_featured = false
   where tenant_id = v_tenant_id
     and is_featured
     and id <> p_bull_id;

  -- The trigger vets the approval requirement on the way in.
  update public.bulls
     set is_featured = p_featured
   where id = p_bull_id;
end;
$$;

grant execute on function public.set_featured_bull(uuid, boolean) to authenticated;

-- ------------------------------------------------------- public read: bulls -

-- bulls never got a public read policy, so `product.bull` comes back null for
-- anonymous visitors and the catalog has been rendering "—" where the breed
-- should be. Mirrors the public_read_active_media precedent: a bull becomes
-- public exactly when it has an ACTIVE product; unpublished bulls stay private.
drop policy if exists "public_read_published_bulls" on public.bulls;
create policy "public_read_published_bulls" on public.bulls
  FOR SELECT
  USING (exists (
    select 1 from public.products p
     where p.bull_id = bulls.id
       and p.status = 'ACTIVE'
  ));

-- ----------------------------------------------------- featured_straws view -

-- One row per featured bull, its approved straws nested, so the home page
-- renders its cards in a single request.
--
-- WARNING: this view reads past the RLS of its base tables — its WHERE clause
-- is the only barrier, and every column listed here is public to anon. That is
-- why the seller is reduced to `business_name`: opening seller_profiles with a
-- FOR SELECT policy would expose contact_phone and address too, since a policy
-- cannot restrict columns. Do not add columns without re-reading this note.
--
-- The `p.status = 'ACTIVE'` join is also what makes a featured bull disappear
-- on its own when the administrator suspends its last approved straw.
create or replace view public.featured_straws as
select
  b.id                as bull_id,
  b.name              as bull_name,
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
where b.is_featured
group by b.id, b.name, br.name, sp.id, sp.business_name;

grant select on public.featured_straws to anon, authenticated;
