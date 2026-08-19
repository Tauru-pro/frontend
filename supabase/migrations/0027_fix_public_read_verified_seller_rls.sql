-- 0023_seller_verification_publishing gave `public_read_active_products` (and
-- the equivalent policies on product_media/bulls) an `EXISTS (SELECT ... FROM
-- seller_profiles ...)` subquery to check the seller is verified. That looks
-- right, but it never actually worked for anon/authenticated (non-seller,
-- non-admin) callers: seller_profiles has RLS enabled with no public-read
-- policy (only the owning seller and admins can read it directly), and a
-- policy's subquery against another RLS-protected table is itself subject to
-- that table's RLS for the *same* querying role — it does not run with
-- elevated rights just because it's embedded in another table's policy. So
-- for anon/CUSTOMER, `seller_profiles` is invisible inside that subquery too,
-- `EXISTS(...)` is always false, and `public_read_active_products` never
-- grants anything to anyone except a seller reading their own row
-- (`seller_own_products`) or an admin (`admin_read_all_products`) — both
-- unrelated policies that happen to still work, which is why this looked
-- auth-dependent: it "worked" only for accounts that hit one of those other,
-- unrelated policies.
--
-- Confirmed live: `bull_listings`/`product_details` (views, read past RLS)
-- show an ACTIVE product from a verified seller just fine, but the base
-- `products` table (what ProductService.getProduct() reads to add to cart)
-- returns 0 rows for that exact same row when queried as anon — for every
-- product, every seller, not just one.
--
-- Fix: a SECURITY DEFINER helper function. It runs with the function owner's
-- privileges (bypasses the caller's RLS on seller_profiles internally), and
-- only ever returns a boolean — never exposes seller_profiles rows to the
-- caller. `set search_path = public` follows the same hardening already used
-- for every other SECURITY DEFINER function in this project (0002, 0003,
-- 0006, 0010, 0011, 0018).

create or replace function public.is_seller_verified(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seller_profiles sp
     where sp.id = p_tenant_id
       and sp.status = 'ACTIVE'
  );
$$;

grant execute on function public.is_seller_verified(uuid) to anon, authenticated;

drop policy if exists "public_read_active_products" on products;
create policy "public_read_active_products" on products
  for select
  using (
    status = 'ACTIVE'
    and public.is_seller_verified(tenant_id)
  );

drop policy if exists "public_read_active_media" on product_media;
create policy "public_read_active_media" on product_media
  for select
  using (
    (entity_type = 'product' and exists (
      select 1 from products p
       where p.id = product_media.entity_id
         and p.status = 'ACTIVE'
         and public.is_seller_verified(p.tenant_id)
    ))
    or
    (entity_type = 'bull' and exists (
      select 1 from products p
       where p.bull_id = product_media.entity_id
         and p.status = 'ACTIVE'
         and public.is_seller_verified(p.tenant_id)
    ))
  );

drop policy if exists "public_read_published_bulls" on public.bulls;
create policy "public_read_published_bulls" on public.bulls
  for select
  using (exists (
    select 1 from public.products p
     where p.bull_id = bulls.id
       and p.status = 'ACTIVE'
       and public.is_seller_verified(p.tenant_id)
  ));
