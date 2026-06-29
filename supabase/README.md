# Supabase setup for the auth migration

This directory holds the SQL migrations and Edge Function written for the
`migrate-auth-to-supabase` change. The frontend code that consumes this is
already implemented; **the steps below still require you to act** — they
need a real Supabase project, dashboard access, and a Google OAuth client,
none of which the assistant that wrote this has access to.

## 1. Project setup (manual, dashboard)

1. Create (or designate) a Supabase project.
2. Copy `Project URL` and `anon` key into `src/environments/environment.ts`
   and `environment.development.ts` (`supabase.url` / `supabase.anonKey`).
3. Authentication → Providers → Google: set the client ID/secret, and set
   the redirect URL to `http://localhost:4200/auth/callback` (and your
   production origin's `/auth/callback` once deployed).
4. Authentication → Email Templates: edit "Confirm signup" and "Invite
   user" to use `{{ .Token }}` instead of the default magic-link URL, so
   users get a 6-digit code (matches the existing verify-email UI).

## 2. Apply the database migrations

Using the Supabase CLI, linked to your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This runs, in order:
- `migrations/0001_profiles_schema.sql` — `profiles`, `seller_profiles`, `customer_profiles`
- `migrations/0002_handle_new_user_trigger.sql` — auto-creates a `CUSTOMER` profile on signup
- `migrations/0003_custom_access_token_hook.sql` — defines `custom_access_token_hook`
- `migrations/0004_rls_policies.sql` — RLS policies + role/status protection trigger

### Activate the Auth Hook (manual, dashboard)

Creating `custom_access_token_hook` does **not** activate it. Go to
Authentication → Hooks → Customize Access Token (JWT) Claims hook, and
select `public.custom_access_token_hook`. Without this step, `user_role`
will never appear in issued JWTs and every RLS policy that checks it will
fail closed.

### Manual smoke test (do this before going further)

- Sign up a normal user → confirm you can only read your own `profiles`
  row (`select * from profiles` as that user should return 1 row).
- As the seeded `SUPER_ADMIN` (next section), confirm you can read every row.

## 3. Deploy the Edge Function

```bash
supabase functions deploy admin-create-user
```

Set secrets (service role key must never reach the frontend bundle):

```bash
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Test that non-SUPER_ADMIN callers are rejected:

```bash
curl -i -X POST 'https://<project-ref>.supabase.co/functions/v1/admin-create-user' \
  -H "Authorization: Bearer <a non-super-admin access token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","fullName":"Test","role":"SELLER"}'
# expect HTTP 403 {"error":"FORBIDDEN"}
```

## 4. Seed the default SUPER_ADMIN

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SEED_SUPER_ADMIN_EMAIL=admin@yourdomain.com \
npm run seed:super-admin
```

Then confirm the invite email and that the account can sign in and reach
`/admin/users`.

## 5. End-to-end checklist (after the above + `npm install`)

- [ ] Register a `CUSTOMER`, verify by 6-digit code, log in.
- [ ] Log in with Google end-to-end.
- [ ] Log in as the seeded `SUPER_ADMIN`, open `/admin/users`, paginate.
- [ ] Create a `SELLER` and a `SUPER_ADMIN` from `/admin/users/new`, confirm
      the invite email and assigned role.
- [ ] Confirm an `ADMIN` account is denied at `/admin/users` and
      `/admin/users/new`.
- [ ] Confirm out-of-scope domains (bulls, supplies, branches, etc.) still
      work with the rewritten interceptor attaching a Supabase access token.
