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

## 6. Checkout, orders & Wompi (`checkout-orders-wompi`)

Migrations `0030`–`0038` add `shipping_rates`, `orders`, `order_items`,
`payments`, `payment_attempts`, `webhook_events`, `order_status_history`, and
the RPC functions (`get_shipping_estimate`, `create_order_with_items`,
`apply_payment_approved`, `apply_payment_failed`, `expire_order`,
`retry_payment`) that back them. Apply with `supabase db push` as above.

### Sandbox setup

```bash
supabase functions deploy create-checkout
supabase functions deploy get-payment-status
supabase functions deploy retry-payment
supabase functions deploy expire-orders
supabase functions deploy reconcile-payments
supabase functions deploy wompi-webhook --no-verify-jwt   # Wompi does not send a Supabase JWT
```

```bash
supabase secrets set WOMPI_PUBLIC_KEY=pub_test_xxx
supabase secrets set WOMPI_INTEGRITY_SECRET=<sandbox integrity secret>
supabase secrets set WOMPI_EVENTS_SECRET=<sandbox events secret>
supabase secrets set WOMPI_ENVIRONMENT=SANDBOX
supabase secrets set WOMPI_API_URL=https://api-sandbox.co.uat.wompi.dev
```

In the Wompi dashboard (sandbox), register the events URL:
`https://<project-ref>.supabase.co/functions/v1/wompi-webhook`.

`expire-orders`/`reconcile-payments` are meant to run on a schedule
(`pg_cron` → `pg_net`, or an external scheduler if `pg_cron` isn't available
on this project — confirm which applies before wiring the schedule), calling
each function's URL with the `service_role` key as the bearer token. They are
never invoked from the browser.

### Production cutover (do not bundle with a code deploy)

Switching to production is a deliberate, separate step — never combined with
shipping a code change:

1. Re-run `supabase secrets set` for `WOMPI_PUBLIC_KEY` / `WOMPI_INTEGRITY_SECRET`
   / `WOMPI_EVENTS_SECRET` with production values, and `WOMPI_ENVIRONMENT=PRODUCTION`
   / `WOMPI_API_URL=https://production.wompi.co`.
2. Register the **production** events URL in the Wompi dashboard (production
   account) — this is a different URL/secret pair from sandbox, not a toggle
   on the same one.
3. Confirm no sandbox transaction can be replayed against production (the
   `WOMPI_ENVIRONMENT` check in `wompi-webhook` rejects a mismatched
   `environment` field on the event payload).

### Manual smoke test (do this before going further)

- [ ] Create an order via `create-checkout` as a normal buyer; confirm the
      response contains no `WOMPI_INTEGRITY_SECRET`/`WOMPI_EVENTS_SECRET`.
- [ ] Submit the same idempotency key twice; confirm only one `orders` row exists.
- [ ] Post a sandbox `APPROVED` webhook; confirm `orders.status = 'PAID'`.
- [ ] Re-post the same webhook payload; confirm no second `order_status_history` row is added.
- [ ] Post a webhook with a tampered `signature.checksum`; confirm `401` and no DB change.
