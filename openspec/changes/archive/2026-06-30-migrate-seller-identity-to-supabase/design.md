## Context

`migrate-auth-to-supabase` created `seller_profiles` in Supabase (`id`, `user_id`, `business_name`, `contact_phone`, `logo_key`, `city_id`, `address`, `status`) and embeds it into `UserStore.loadUser()`'s `select('*, seller_profiles(*), customer_profiles(*)')`. Nothing ever writes to that table, though: `handle_new_user()` only inserts into `profiles` (role `CUSTOMER`), and `admin-create-user` only updates `profiles.role`. Meanwhile `SellerService` (`core/services/seller.service.ts`) and `UserService.getSellers()` still read/write the legacy NestJS backend's own seller-profile store. The two are different databases — a `SELLER` logging in today gets an empty `sellerProfile` from `UserStore`, while `seller-settings.component.ts` independently round-trips to the legacy backend, which still has the real data. The admin's `/admin/sellers` list (`sellers.component.ts` → `UserService.getSellers()`) has the same problem in reverse: once writes move to Supabase, that list would keep showing legacy-backend data and silently drift.

`openspec/specs/agents.md`'s example RLS policy reads `tenant_id` from `auth.jwt() -> 'user_metadata' ->> 'tenant_id'`. `user_metadata` is client-settable via `supabase.auth.updateUser()` — trusting it in an RLS policy would let a `SELLER` forge any `tenant_id`. This design uses the same verified-claim mechanism already established for `user_role` (`custom_access_token_hook`, `security definer`) instead.

## Goals / Non-Goals

**Goals:**
- One source of truth for seller business identity: `seller_profiles` in Supabase, read and written exclusively through `supabase-js`.
- A verified, non-forgeable `tenant_id` JWT claim (`seller_profiles.id` for `SELLER`s, `null` otherwise), available for this change's own RLS and for future tenant-scoped tables (branches, products, inventory).
- Self-service tenant creation: a `SELLER`'s first save of the settings form creates their `seller_profiles` row (upsert) — no separate provisioning step.
- Admin's seller list (`/admin/sellers`) reads the same Supabase data sellers write, so it can't drift.

**Non-Goals:**
- No file storage migration — logo upload keeps using the legacy backend's S3 presign endpoint (AWS credentials live only there).
- No country/location model changes — `country` is a free-text column, not a new relational entity.
- No store-approval workflow for `SUPER_ADMIN` (RF-011-style moderation is about products, not stores; not requested here).
- No branches/products/inventory tables (Módulos 3/5/6) — only the `tenant_id` claim they'll need is established now.

## Decisions

### 1. `tenant_id` = `seller_profiles.id`, injected by the existing Auth Hook
No new `tenants` table. RF-006 frames store registration as singular ("un `SELLER` puede dar de alta **su** ganadería"), matching today's 1-row-per-user assumption (`seller_profiles.user_id` has no current multi-row use). Extend `custom_access_token_hook` (already `security definer`, already reads `profiles` for `user_role`) to also look up `seller_profiles.id where user_id = (event ->> 'user_id')::uuid` and set claim `tenant_id` (string UUID or `null`). This reuses the proven pattern instead of inventing a second hook or a separate claims mechanism.
- Alternative considered: a dedicated `tenants` table decoupled from `seller_profiles` — rejected as unnecessary complexity for an MVP where the relationship is always 1:1; can be introduced later without touching the claim shape (`tenant_id` would just point at a different table's `id`).

### 2. `SellerService.updateMyProfile()` becomes an upsert
```ts
await supabase.from('seller_profiles').upsert(
  { user_id: authUser.id, ...dto },
  { onConflict: 'user_id' }
).select().single();
```
Requires a `unique` constraint on `seller_profiles.user_id` (doesn't exist today) — added in this change's migration. This is what makes "self-service creation on first save" work without a separate insert path or a trigger.
- Alternative considered: auto-provision an empty `seller_profiles` row from `admin-create-user` when a `SELLER` is invited — rejected because RF-006 frames registration as the seller's own action, and it would mean the row exists with no data the seller actually entered, indistinguishable from "registered but empty."

### 3. Logo confirm moves from legacy endpoint to direct Supabase update
`getPresignedUrl()` stays on the legacy backend (S3 presign needs AWS credentials this repo doesn't have). After a successful `PUT` to the presigned URL, `confirm(s3Key)` no longer calls the legacy `/logo/confirm` endpoint (which would write to a database the app no longer reads); instead it does `supabase.from('seller_profiles').update({ logo_key: s3Key }).eq('user_id', authUser.id)`. The CDN URL construction (`environment.cdn + '/' + logoKey`) is unchanged.

### 4. RLS on `seller_profiles`
```sql
-- owner: full access to their own row
create policy "seller_profiles_owner" on public.seller_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ADMIN/SUPER_ADMIN: read all (for /admin/sellers)
create policy "seller_profiles_select_admin" on public.seller_profiles
  for select using ((auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN'));
```
This replaces the migration-0004-era `seller_profiles_owner` policy (which already used `auth.uid() = user_id or user_role = 'SUPER_ADMIN'` for `all`) with an explicit owner-`with check` (needed for the new upsert path to pass the insert branch) plus a separate admin-read policy that also covers plain `ADMIN` (today only `SUPER_ADMIN` could read all; the admin sellers list needs to work for `ADMIN` too, matching `adminGuard`'s `['ADMIN','SUPER_ADMIN']`).

### 5. `UserService.getSellers()` reads `seller_profiles` joined with `profiles`
```ts
supabase
  .from('seller_profiles')
  .select('*, profiles!inner(email, created_at)', { count: 'exact' })
  .range(from, to)
```
Keeps the `PaginatedResponse<SellerProfile>` contract `sellers.component.ts` already consumes. While touching this component, also fix its existing type/field inconsistency (template mixes `s.bussinesName`/`s.sellerProfile?.status`/`s.status` against a signal typed `SellerProfile[]` — `sellerProfile` doesn't exist on that type; this predates this change but is touched by the same edit).

## Risks / Trade-offs

- [`unique` constraint on `seller_profiles.user_id` could fail to apply if duplicate rows already exist from manual testing] → Check for duplicates before adding the constraint; this project's `seller_profiles` table has never been written to in production (confirmed: only `migrate-auth-to-supabase`'s embed-select reads it), so this is theoretical, not expected.
- [Extending `custom_access_token_hook` changes the JWT shape for every user, not just `SELLER`s] → Acceptable: `tenant_id: null` for non-sellers is harmless and mirrors how `user_role` already defaults safely.
- [`ADMIN` gaining read access to all `seller_profiles` is a permission widening vs. today's `SUPER_ADMIN`-only `for all` policy] → Intentional and narrower than it sounds: it's read-only, and `adminGuard` already gates `/admin/sellers` to `['ADMIN','SUPER_ADMIN']`, so this just makes RLS match the guard that's already in place.

## Migration Plan

1. SQL migration: add `description`, `country` (default `'Colombia'`), `business_hours` to `seller_profiles`; add `unique(user_id)`; replace the owner RLS policy and add the admin-read policy; update `custom_access_token_hook` to inject `tenant_id`.
2. Rewrite `SellerService` (`getMyProfile`/`updateMyProfile` → Supabase upsert/select; `confirm` → Supabase update; `getPresignedUrl` unchanged).
3. Rewrite `UserService.getSellers()` against Supabase.
4. Update `seller-settings.component.ts` (new fields, call-site changes) and `sellers.component.ts` (data source + type cleanup).
5. Apply the migration against the real project, deploy, verify with a fresh JWT that `tenant_id` appears, and manually test the self-service upsert end-to-end.

**Rollback**: revert the frontend commit; the legacy backend's seller-profile endpoints are untouched and still work, so reverting restores today's (buggy but functioning) split-brain state — no data is deleted by this change.

## Open Questions

- Should newly self-registered stores default to `status = 'PENDING'` and require a `SUPER_ADMIN` action to become `ACTIVE` (implied by the broader project vision's "flujo estricto de aprobación"), or is `ACTIVE` immediately acceptable for now? This design preserves the existing column default (`PENDING`) and adds no new approval UI — flagging in case that's not the intended MVP behavior.
