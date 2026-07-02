-- Módulo 2 (Gestión Multi-Tenant e Identidad Comercial): extends
-- seller_profiles for self-service store registration (RF-006), tightens
-- its RLS, and injects a verified tenant_id JWT claim (RF-005) instead of
-- trusting client-modifiable user_metadata.

alter table public.seller_profiles
  add column if not exists description text,
  add column if not exists country text not null default 'Colombia',
  add column if not exists business_hours text;

-- Required for the upsert-on-first-save self-registration flow
-- (ON CONFLICT (user_id) DO UPDATE).
alter table public.seller_profiles
  add constraint seller_profiles_user_id_key unique (user_id);

-- Replace the old "owner or SUPER_ADMIN, full access" policy: the owner gets
-- an explicit WITH CHECK (needed so the upsert's INSERT branch passes), and
-- admin access becomes its own read-only policy covering ADMIN too (the old
-- policy only covered SUPER_ADMIN, and granted write access nothing in the
-- app actually uses today).
drop policy if exists "seller_profiles_owner" on public.seller_profiles;

create policy "seller_profiles_owner" on public.seller_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "seller_profiles_select_admin" on public.seller_profiles
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));

-- Extend the Auth Hook to also inject `tenant_id` (the caller's
-- seller_profiles.id, or JSON null if they don't have a store) so RLS for
-- this and future tenant-scoped tables can rely on a verified claim instead
-- of auth.jwt() -> 'user_metadata' (client-settable, unsafe for isolation).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  profile_role text;
  seller_tenant_id uuid;
begin
  select role into profile_role
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  select id into seller_tenant_id
  from public.seller_profiles
  where user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(profile_role, 'CUSTOMER')));
  claims := jsonb_set(claims, '{tenant_id}', coalesce(to_jsonb(seller_tenant_id), 'null'::jsonb));
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;
