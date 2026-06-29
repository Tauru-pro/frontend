-- Injects profiles.role into the JWT as the `user_role` claim on every
-- token issue/refresh, so RLS policies and Edge Functions can check
-- `auth.jwt() ->> 'user_role'` without recursing into a profiles SELECT
-- from inside a profiles RLS policy.
--
-- NOTE: creating this function does not activate it. After running this
-- migration you must still enable it as a Custom Access Token Auth Hook in
-- the Supabase Dashboard (Authentication -> Hooks) — see supabase/README.md.

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
begin
  select role into profile_role
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(profile_role, 'CUSTOMER')));
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

-- The Auth Hook runs as supabase_auth_admin, not as the calling user, so it
-- needs explicit grants and must not be callable by regular API roles.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on public.profiles to supabase_auth_admin;
