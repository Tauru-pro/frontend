## 1. Backend: document review + status recompute

- [x] 1.1 Add a `seller-document-validate` Supabase Edge Function (service-role) that sets a document's `status`/`rejection_reason` and, after approval, recomputes `sellers.status` (`PENDING` → `ACTIVE`) once both `RUT` and `LEGAL_REP` are `APPROVED`
- [x] 1.2 Add RLS policy so only `SUPER_ADMIN`/`ADMIN` can invoke the document-approve/reject path, and only the recompute logic (not direct client writes) can set `sellers.status = 'ACTIVE'`
- [x] 1.3 Add `approveSellerDocument`/`rejectSellerDocument` methods to `core/services/seller-document.service.ts` calling the new Edge Function
- [x] 1.4 Add a `getPendingDocumentsCount` method (mirroring `product.service.ts`'s `getPendingCount`) for the sidebar badge

## 2. Backend: product publish gate

- [x] 2.1 Update the `products` table RLS `UPDATE`/`INSERT` policy so a `SELLER` can only write `status = 'ACTIVE'` when their `sellers.status = 'ACTIVE'` for that `tenant_id`, keeping `SUPER_ADMIN`/`ADMIN` able to set any status for moderation
- [x] 2.2 Update `core/services/product.service.ts`: replace/retire `submitForValidation` with a direct-publish call that sets `status = 'ACTIVE'` (relying on RLS to reject when the seller is unverified), surfacing the RLS rejection as a user-facing error
- [x] 2.3 Confirm `validateProducts`/`product-validate` Edge Function and its admin queue reads (`getAllPendingValidation`, `getPendingStrawListings`, `getPendingSupplies`, `getPendingCount`) remain functional but are only reachable from `/admin/products` for clearing legacy `PENDING_VALIDATION` rows

## 3. Backend: catalog visibility

- [x] 3.1 Update the public catalog query/RLS policy (used by `/catalogo` and `/catalogo/:id`) to require both `products.status = 'ACTIVE'` AND the owning seller's `sellers.status = 'ACTIVE'`
- [x] 3.2 Update the bull-visibility policy/query (the one backing "Bull data of active products is readable without a session") with the same seller-verification condition

## 4. Backoffice UI: seller document review

- [x] 4.1 Add a document review section to `features/backoffice/sellers/sellers.component.ts` (currently read-only) or a seller-detail sub-view: list documents per seller with status and approve/reject actions, reusing patterns from `features/backoffice/products/product-review.component.ts`
- [x] 4.2 Wire approve/reject actions to the new `seller-document.service.ts` methods, including a required-reason input on reject
- [x] 4.3 Add the pending-documents badge to the backoffice sidebar (mirroring the existing pending-products badge), fetched once on backoffice layout init

## 5. Seller UI: verification feedback

- [x] 5.1 Update `features/seller/legal-documents/seller-legal-documents.component.ts` to display the rejection reason on `REJECTED` documents and allow re-upload (resetting status to `PENDING_REVIEW`)
- [x] 5.2 Add a verification-status banner to the seller product create/edit/list screens (`features/seller` bulls/products area) shown when `SellerProfile.status !== 'ACTIVE'`, linking to `seller/legal-documents`
- [x] 5.3 Disable/hide the "Publicar" action on product forms when the seller is not verified; keep create/edit/delete (draft) actions enabled
- [x] 5.4 Update the seller product list to reflect direct-publish (no more "enviar a revisión" wording/status for the default flow) for verified sellers

## 6. Rollout

- [ ] 6.1 Deploy Edge Function + admin document review UI first (task groups 1 and 4), gated by existing `superAdminGuard`/`adminGuard`, with no seller/buyer-facing behavior change yet
- [ ] 6.2 Deploy the RLS policy changes (task groups 2 and 3) together with the seller-facing UI changes (task group 5) in the same release
- [ ] 6.3 After deploy, manually clear the existing `PENDING_VALIDATION` product queue via `/admin/products` and review any already-uploaded seller documents via the new screen to bootstrap the first verified sellers

## 7. Testing

- [x] 7.1 Add/update Vitest specs for `seller-document.service.ts` (approve/reject/status recompute) and `product.service.ts` (direct-publish call path)
- [ ] 7.2 Manually verify RLS behavior against Supabase (unverified seller cannot force `ACTIVE`; verified seller can; admin can always moderate) since there is no automated RLS test harness in this repo
- [ ] 7.3 Manually verify `/catalogo` and `/catalogo/:id` no longer show a suspended-seller's previously `ACTIVE` products
