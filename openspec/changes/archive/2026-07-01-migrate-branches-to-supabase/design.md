## Context

`BranchService` (`core/services/branch.service.ts`) is full CRUD (`getMyBranches`, `getBranch`, `createBranch`, `updateBranch`, `deleteBranch`, `setMain`) against the legacy backend (`environment.apiUrl/branches`), consumed by `branch-list.component.ts` and `branch-form.component.ts` under `/seller/branches`. No admin-side branches view exists. The current `Branch` model has no GPS fields and no operating-hours field.

`migrate-seller-identity-to-supabase` already extended `custom_access_token_hook` to inject a verified `tenant_id` claim (= the caller's `seller_profiles.id`, or `null`). This change is the first real consumer of that claim for RLS, exactly as RF-005 specifies.

## Goals / Non-Goals

**Goals:**
- `branches` table in Supabase, isolated by the verified `tenant_id` claim (not `auth.uid()` directly — a tenant's resources should be addressable by tenant, matching RF-005's literal model, even though today tenant === owner 1:1).
- Cover RF-007's full field list: name, address, GPS coordinates, city, business hours, status.
- Preserve existing UX (`isMain` designation, delete confirmation, pagination) without behavioral regressions.
- Establish the `branches` RLS pattern (owner via `tenant_id`, admin read-all) as the template Módulos 5/6 (products/inventory) will reuse.

**Non-Goals:**
- No map picker / geocoding — latitude/longitude are plain numeric inputs.
- No public read access — nothing in the current app needs to browse branches outside `/seller/branches`. Módulo 7 (checkout branch selection) will need this later; adding it now would be unused surface area.
- No data migration from the legacy backend.
- No admin-side branches list — none exists today, not requested.

## Decisions

### 1. `branches.tenant_id`, not `branches.user_id`
```sql
branches(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.seller_profiles(id) on delete cascade,
  name text not null,
  address text not null,
  phone text,
  city_id uuid,
  latitude numeric,
  longitude numeric,
  business_hours text,
  is_main boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
)
```
RLS policies key off `(auth.jwt() ->> 'tenant_id')::uuid = tenant_id`, not `auth.uid()`. This is deliberately consistent with RF-005's model (`tenantId = context.tenantId`) rather than reusing the owner-by-`user_id` pattern from `seller_profiles` — `seller_profiles` represents identity (1:1 with a user), `branches` represents tenant-owned resources, which is the distinction Módulo 2 was built to support.
- `unique(tenant_id, name)` reproduces the legacy 409-on-duplicate-name behavior `branch-form.component.ts` already handles.

### 2. `is_main` invariant enforced by trigger, not application code
Two behaviors, one `BEFORE INSERT OR UPDATE` trigger:
```sql
create or replace function public.enforce_single_main_branch()
returns trigger
language plpgsql
as $$
begin
  if new.is_main then
    update public.branches
    set is_main = false
    where tenant_id = new.tenant_id and id <> new.id and is_main;
  elsif tg_op = 'INSERT' and not exists (
    select 1 from public.branches where tenant_id = new.tenant_id
  ) then
    new.is_main := true;
  end if;
  return new;
end;
$$;
```
This makes `setMain(id)` a single `update({is_main: true}).eq('id', id)` call — the trigger unsets the previous main atomically, no client-side two-step risk. It also guarantees a tenant's first branch becomes main automatically, an invariant the legacy backend's behavior is unknown/unverifiable (no access to that repo) but is safe to establish going forward.
- Alternative considered: a Postgres RPC function (`set_main_branch(id)`) callable via `supabase.rpc(...)` — rejected as unnecessary; a trigger keeps `BranchService` symmetric with its other plain-update methods.

### 3. `city` becomes optional on `Branch`, same as `SellerProfile`
No `cities` table exists in Supabase (cities live in the legacy backend, out of scope — already an accepted limitation from prior changes). `branch-list.component.ts`/`branch-form.component.ts` already use optional chaining (`branch.city?.name`) despite the type declaring `city` as required — this change just makes the type honest. `cityId` continues to flow through `LocationSelectComponent`, which still talks to the legacy location endpoints (unrelated to where branches are stored).

### 4. `BranchService.getMyBranches()` stays Observable; mutations become Promises
Same reasoning as `BreedService`: `getMyBranches()` has one consumer (`branch-list.component.ts`) today, so there's no multi-consumer reason to keep it Observable except minimizing the component diff — wrapping via `from(...)` avoids touching the list component's `.subscribe()` call site. Mutations (`createBranch`, `updateBranch`, `deleteBranch`, `setMain`) are only called from form/list action handlers, so they become plain `async` methods returning `Promise`, matching `BreedService`/`SellerService`.

## Risks / Trade-offs

- [No public read means Módulo 7 will need a follow-up RLS change] → Acceptable: avoids speculative policy surface for a feature that doesn't exist yet; the policy is additive when that module ships.
- [`unique(tenant_id, name)` could reject legitimate reuse of a branch name across two different (hypothetical future) tenants under the same seller] → Not applicable today: tenant === seller 1:1, so this is equivalent to "unique per seller," matching current legacy behavior.
- [GPS as plain numeric inputs is easy to mis-enter] → Acceptable for this iteration; RF-007 only requires the fields exist, not a particular input UX.

## Migration Plan

1. SQL migration: `branches` table, RLS (owner via `tenant_id`, admin read-all), `enforce_single_main_branch` trigger, `updated_at` trigger (reuse `public.set_updated_at()` from `migrate-breeds-to-supabase`).
2. Rewrite `BranchService` against `supabase-js`.
3. Update `branch-form.component.ts` (GPS + business hours fields, Promise call sites) and `branch-list.component.ts` (Promise call sites for delete/set-main).
4. Apply the migration against the real project, verify RLS with a real tenant (an upsert/insert through the anon-key+JWT path, not just as `postgres`), verify the single-main-branch trigger.

**Rollback**: revert the frontend commit; the legacy backend's `/branches` endpoints are untouched.

## Open Questions

- Does the legacy backend have real branch data today that needs to be carried over, or is this still test data? (Same open question carried from `migrate-breeds-to-supabase`/`migrate-seller-identity-to-supabase` — no access to that backend to check.)
