## Context

`Breed` (`id`, `name`, `purpose: 'MILK' | 'MEAT'`, `createdAt`, `updatedAt`) is read by three unrelated areas today, all through the single `BreedService.getAll()` (`HttpClient` → `environment.apiUrl/breeds`):
- `features/marketplace/home/home.component.ts` — public storefront, unauthenticated visitors.
- `features/seller/bulls/bull-form.component.ts` — sellers picking a breed when listing a bull.
- `features/backoffice/breeds/breeds.component.ts` — admin catalog management (list/create/edit/delete).

`bull.model.ts` embeds a full `Breed` object on `Bull.breed`, but that comes from the bulls endpoint (legacy backend, out of scope), not from `BreedService` — no change needed there.

This builds directly on `migrate-auth-to-supabase` (archived): it reuses the `user_role` JWT claim (via `custom_access_token_hook`), the `superAdminGuard`, and the same Supabase project/client already wired into the app (`core/auth/supabase-client.ts`).

## Goals / Non-Goals

**Goals:**
- Move breed storage to a Supabase `breeds` table; anyone (including unauthenticated visitors) can read it, only `SUPER_ADMIN` can write.
- Reuse `superAdminGuard` to lock `/admin/breeds`, `/admin/breeds/new`, `/admin/breeds/:id/edit` to `SUPER_ADMIN` (currently any `ADMIN`).
- Keep `Breed`/`CreateBreedDto`/`UpdateBreedDto` shapes unchanged so `breeds.component.ts`/`breed-form.component.ts` need no template/logic changes beyond the data-fetching call style.

**Non-Goals:**
- No change to `bull.model.ts` or the bulls/supplies/branches/pickup-points/shipping-rates/settings domains — they keep using the legacy backend.
- No data migration tooling: if real breed rows exist today in the legacy backend's database, this change does not export/import them (see Open Questions).
- No change to how `Bull.breed` is populated (still comes from the legacy bulls endpoint).

## Decisions

### 1. New Supabase table `breeds`, public SELECT, `SUPER_ADMIN`-only writes
```sql
breeds(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  purpose text not null check (purpose in ('MILK', 'MEAT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```
RLS: a `breeds_select_all` policy with `using (true)` for `select` (anon + authenticated — the public marketplace and seller bull-form both need this with no session), and a `breeds_write_super_admin` policy with `using ((auth.jwt() ->> 'user_role') = 'SUPER_ADMIN')` for `insert`/`update`/`delete`. The `unique` constraint on `name` reproduces today's 409-on-duplicate-name behavior (`breed-form.component.ts` already has a 409 branch).
- Alternative considered: keep writes open to `ADMIN` too (matching the old `adminGuard`-only gate) — rejected per explicit decision to restrict to `SUPER_ADMIN` only, consistent with how `super-admin-user-management` already restricts user creation.

### 2. `BreedService.getAll()` stays Observable-returning; mutations become `Promise`-returning
`getAll()` is called via `.subscribe()` from three independent components (home, bull-form, breeds-admin). Wrapping a Supabase call in `from(...)` keeps that call-site contract intact across all three without touching unrelated marketplace/seller code — lower risk than converting three components to `async/await` for a read-only list call.
`create`/`update`/`delete` are only called from `breed-form.component.ts`/`breeds.component.ts` (this change's own scope), so they're rewritten as plain `async` methods returning `Promise<Breed>`/`Promise<void>`, matching the pattern already used for `UserService.createUser` in the auth migration — `breed-form.component.ts`/`breeds.component.ts` swap `firstValueFrom(...)` for direct `await`.
- Alternative considered: convert everything to `async/await` including `getAll()` — rejected to avoid editing `home.component.ts` and `bull-form.component.ts`, which are unrelated to this change's purpose.

### 3. `superAdminGuard` reused as-is, applied at the route level
No new guard needed — `core/guards/super-admin.guard.ts` already exists and is generic (checks `userStore.user()?.role === 'SUPER_ADMIN'`). Apply it via `canActivate` on the three `breeds` routes in `backoffice-routes.ts`, the same way it's applied to the `users` routes.

### 4. No backend/legacy cleanup
The legacy backend's `/breeds` REST endpoints (if they exist) are left untouched — this is a frontend-only repo and the backend is out of reach. `BreedService` simply stops calling them.

## Risks / Trade-offs

- [If real breed data exists only in the legacy backend's database, it disappears from the user's perspective after this ships, since the new Supabase table starts empty] → Mitigation: re-create the current catalog's rows manually in Supabase before/at cutover (see Open Questions — need the current list).
- [Public SELECT on `breeds` with `using (true)` means anyone with the anon key can read all rows, including via direct REST calls bypassing the UI] → Acceptable: breed names/purpose are not sensitive, the same data is already served unauthenticated today via the legacy backend's `/breeds` GET.
- [`ADMIN`s who today manage breeds lose access] → Intentional per explicit decision; same trade-off already accepted for `/admin/users`.

## Migration Plan

1. Apply a new Supabase migration creating `breeds` + RLS policies (mirrors `migrate-auth-to-supabase`'s `supabase/migrations/` pattern).
2. Rewrite `BreedService` to use `supabase-js`.
3. Update `breed-form.component.ts`/`breeds.component.ts` call sites from `firstValueFrom(...)` to direct `await` for the mutation methods (`getAll()` call sites unchanged).
4. Add `superAdminGuard` to the three `breeds` routes in `backoffice-routes.ts`.
5. Manually verify: public home page still loads breeds with no session; seller bull-form breed dropdown still populates; `SUPER_ADMIN` can create/edit/delete; an `ADMIN` (non-super) is redirected away from `/admin/breeds`.

**Rollback**: revert the frontend commit (the legacy backend's `/breeds` endpoints, if any, are untouched and still work) — no destructive Supabase changes are made to other tables.

## Open Questions

- Does the legacy backend currently have real breed rows that need to be carried over, or is this still seed/placeholder data? If real, we need that list before cutover to seed the new Supabase table.
- Does the legacy backend's `/breeds` endpoints actually exist today, or was the frontend built ahead of the backend? (Out of scope to verify — no access to that repo from here.)
