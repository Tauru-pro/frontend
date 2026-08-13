## Context

Products currently publish through a per-product moderation queue: a `SELLER` calls `ProductService.submitForValidation(id)` to move a product to `PENDING_VALIDATION`, and a `SUPER_ADMIN` calls `ProductService.validateProducts(...)` (backed by the `product-validate` Supabase Edge Function) to approve/reject/request-changes, per product, every time.

Separately, sellers already upload legal documents (`RUT`, `LEGAL_REP`) through `seller-document.service.ts` and `features/seller/legal-documents/seller-legal-documents.component.ts` against a `seller_documents` table and private Storage bucket. `SellerProfile.status` (`PENDING | ACTIVE | SUSPENDED`) already exists on the `sellers` table but nothing currently reads or writes it — there is no admin screen to review documents, no code path that ever moves a seller out of `PENDING`, and `seller.guard.ts` only checks `role`, never `status`.

This change wires those two pieces together: seller verification (document review) becomes the publish gate, replacing per-product admin review for verified sellers.

## Goals / Non-Goals

**Goals:**
- Let a verified seller (`SellerProfile.status = ACTIVE`) publish products immediately, with no per-product admin step.
- Let a non-verified seller keep creating/editing products, but never reach a publicly-visible state.
- Give admins a document review screen that approves/rejects individual documents and drives the seller's verification status automatically.
- Keep the catalog visibility rule correct even if a previously-verified seller is later suspended.

**Non-Goals:**
- Redesigning the document upload UX itself (`seller-legal-documents.component.ts` already exists and is out of scope beyond adding rejection-reason display).
- Introducing new document types beyond the existing `RUT`/`LEGAL_REP`.
- Re-review of already-`ACTIVE` products retroactively; this change only affects future publish actions.
- A `SellerStatus` value dedicated to "documents rejected" — rejection is tracked per-document; the seller stays `PENDING` until all required documents are `APPROVED`.
- Automatic demotion of a verified seller back to `PENDING` if a document is later re-rejected on re-upload (see Open Questions).

## Decisions

### 1. Verification gate lives on the seller, publish action lives on the product
`SellerProfile.status = ACTIVE` becomes a precondition for a product ever reaching `ProductStatus.ACTIVE`. The existing `PENDING_VALIDATION` → `SUPER_ADMIN` review path is no longer the default: a verified seller's "Publicar" action sets `status = ACTIVE` directly. `PENDING_VALIDATION`, `REJECTED`, `CHANGES_REQUESTED` remain valid enum values (avoids a data migration on existing rows) but are no longer entered by the new default flow.
- **Alternative considered**: keep per-product review but auto-approve for verified sellers. Rejected — it keeps dead code paths (queue, badge, review UI) live for a case that never fires under the new rule, adding maintenance cost with no behavior difference from a direct-publish gate.

### 2. Enforce the publish gate in Postgres RLS, not just the client
The `products` table `UPDATE`/`INSERT` policy for `SELLER` gets a `WITH CHECK` clause: a row may only be written with `status = 'ACTIVE'` if the caller's `sellers.status = 'ACTIVE'` for that `tenant_id`. This matches the existing pattern (`product-validation` spec: "Only SUPER_ADMIN can change product validation status... via RLS") and prevents a client-side bypass of the disabled "Publicar" button.
- **Alternative considered**: enforce only in Angular (disable button, guard the service call). Rejected — client-only checks are not a security boundary; the existing spec already commits to RLS-level enforcement for this kind of rule.

### 3. Document approval and status promotion happen together in one Edge Function
Add a `seller-document-validate` Edge Function (service-role), mirroring the existing `product-validate` function: it sets the target document's `status`/`rejection_reason`, then recomputes `sellers.status` by checking whether every required document type (`RUT`, `LEGAL_REP`) for that tenant is `APPROVED` — if so, sets `sellers.status = 'ACTIVE'`. This keeps the "recompute derived status" logic server-side and atomic with the approval action, rather than split across a DB trigger and client code.
- **Alternative considered**: Postgres trigger on `seller_documents` UPDATE. Rejected for consistency — the codebase already uses the Edge-Function-does-the-write-and-side-effect pattern for `product-validate`; introducing a second mechanism (DB triggers) for the same class of problem adds a new pattern to learn for one feature.

### 4. Catalog visibility checks both product and seller status
`public-product-catalog`'s RLS/query for `ACTIVE` products adds a join/check against `sellers.status = 'ACTIVE'`. This covers the case where a seller is `SUSPENDED` after publishing — their previously-`ACTIVE` products must stop appearing without needing a bulk product-status rewrite.

### 5. Guards stay role-only; verification is a service/UI concern
`seller.guard.ts` continues to gate on `role = SELLER` only. Verification state is surfaced as a banner + disabled action in the product form/list, not a route guard — an unverified seller must still reach their product list/form (to create drafts), so blocking the route would contradict the "can keep creating products" requirement.

## Risks / Trade-offs

- **[Risk]** RLS policy bug could let an unverified seller's product leak to `ACTIVE`, or block a verified seller's legitimate publish. → Mitigation: cover both cases with RLS-level integration tests (or manual Supabase SQL tests) before merging the policy change, since there is no existing RLS test harness in this repo (per `npm test` covering only Angular unit tests).
- **[Risk]** Existing products already sitting in `PENDING_VALIDATION` become orphaned — the admin queue UI (`product-review.component.ts`) still exists but is no longer the primary path, and those sellers may not yet have gone through document verification. → Mitigation: see Migration Plan; no automatic status rewrite, admins clear the existing queue manually post-deploy.
- **[Trade-off]** Removing the per-product review step means a verified seller could publish a policy-violating listing with no admin checkpoint before it's public. → Accepted per explicit business requirement; `SUSPENDED`/`REJECTED` on the product remain available for post-publish moderation.
- **[Risk]** A seller re-uploading a corrected document after rejection could silently flip an otherwise-still-`PENDING` profile straight to `ACTIVE` if the recompute logic has an off-by-one on "all required types" (e.g. missing the second required type entirely counts as vacuously satisfied). → Mitigation: recompute logic must explicitly check both required types are present AND `APPROVED`, not just "no rejected documents remain."

## Migration Plan

1. Ship the `seller_documents`/`sellers` status-recompute Edge Function and admin review UI first, behind the existing `superAdminGuard`/`adminGuard` (no user-facing change yet for sellers/buyers).
2. Ship the RLS policy changes for `products` (publish gate) and the catalog visibility join, plus the seller-facing "Publicar" UI change, in the same deploy — these must land together since the UI depends on the new RLS behavior.
3. Post-deploy, `SUPER_ADMIN` manually works through: (a) the existing `PENDING_VALIDATION` product queue via the legacy review screen (still functional, just no longer the default entry point) to resolve any in-flight submissions, and (b) any already-uploaded seller documents via the new review screen, to bootstrap the first cohort of verified sellers.
4. No rollback data migration is needed: `ProductStatus`/`SellerStatus` enum values are unchanged, so reverting the RLS policies and UI restores the previous flow without a schema change.

## Open Questions

- Should a `SUSPENDED` seller's already-`ACTIVE` products be bulk-transitioned to a non-public status, or is the catalog-query join (Decision 4) sufficient on its own? Current design relies solely on the query-time join — confirm this is acceptable rather than also wanting the product rows themselves updated.
- Should re-rejecting a document after a verified seller re-uploads it (e.g., a periodic re-verification) demote `sellers.status` back to `PENDING`? Out of scope for this change per Non-Goals, but worth flagging since the Edge Function will already have the logic to promote — demoting is the missing symmetric case.
