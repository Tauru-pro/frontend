## Why

Every product currently needs a `SUPER_ADMIN` to individually approve it before it appears in the marketplace, even for sellers who have already proven their business is legitimate. This creates review backlog for every single listing and gives no incentive for sellers to complete legal verification early. Moving the approval gate to the seller's legal-document verification (already partially built via `seller-document.service.ts` and the seller-facing upload UI) lets verified sellers publish freely while keeping unverified sellers visibly restricted to draft-only listings.

## What Changes

- **BREAKING**: Products from a verified (`SellerProfile.status = ACTIVE`) seller no longer go through the `PENDING_VALIDATION` → `SUPER_ADMIN` approval queue — they publish directly to `ACTIVE` on submission.
- **BREAKING**: Products from a non-verified seller (`SellerProfile.status = PENDING` or `SUSPENDED`) can be created and edited freely, but cannot reach `ACTIVE`/publish state — the "publish" action is blocked in the UI and rejected server-side regardless of product completeness.
- Add an admin review screen for seller legal documents (`RUT`, `LEGAL_REP`, already uploadable today) so a `SUPER_ADMIN`/`ADMIN` can approve or reject each document with a reason.
- Add the status transition: once all required documents for a seller are `APPROVED`, the seller's `SellerProfile.status` automatically transitions from `PENDING` to `ACTIVE`.
- Add a rejection path: rejecting a document keeps the seller `PENDING`, surfaces the rejection reason to the seller, and lets them re-upload; re-upload resets that document to `PENDING_REVIEW`.
- Extend the public catalog visibility rule so a product only appears at `/catalogo` when both `product.status = ACTIVE` AND its seller's `SellerProfile.status = ACTIVE` (covers the edge case where a previously-verified seller is later `SUSPENDED`).
- Add a pending-documents count badge in the backoffice sidebar (mirroring the existing pending-products badge) so admins see outstanding legal-document reviews.
- Update seller-facing product forms/list to show a persistent verification-status banner explaining why "Publicar" is disabled when unverified.
- The existing per-product `SUPER_ADMIN` review queue (`PENDING_VALIDATION`, `CHANGES_REQUESTED`) is removed as the default publish path; it is not reused for any other purpose in this change.

## Capabilities

### New Capabilities
- `seller-verification-review`: `SUPER_ADMIN`/`ADMIN` reviews uploaded seller legal documents (`RUT`, `LEGAL_REP`), approves or rejects each with a reason, and the system automatically promotes the seller's verification status once all required documents are approved.

### Modified Capabilities
- `product-validation`: Replaces the mandatory per-product `SUPER_ADMIN` approval gate. Verified sellers' products publish immediately without admin review. Non-verified sellers' products can be created/edited but cannot be published (cannot reach `ACTIVE`), independent of any admin action on the product itself.
- `public-product-catalog`: The catalog/detail visibility rule now also requires the owning seller to be verified (`SellerProfile.status = ACTIVE`), not only `product.status = ACTIVE`.

## Impact

- **Models**: `core/models/product.model.ts` (`ProductStatus` transition rules), `core/models/user.model.ts` (`SellerStatus` transition trigger), `core/models/seller-document.model.ts` (no shape change, now drives status transitions).
- **Services**: `core/services/product.service.ts` (`submitForValidation`/`validateProducts` replaced by direct-publish + verification-gated publish logic), `core/services/seller-document.service.ts` (add admin approve/reject methods), `core/services/user.service.ts` (add seller status transition method).
- **Backend (Supabase)**: RLS policies gating product `INSERT`/`UPDATE` to `ACTIVE` status by seller verification; the `product-validate` Edge Function's role either changes scope or is retired for the direct-publish path; a new Edge Function or RLS policy for document approval triggering the seller status transition.
- **Backoffice UI**: New admin document-review screen (parallel to existing `features/backoffice/products/product-review.component.ts`), updates to `features/backoffice/sellers/sellers.component.ts` (currently read-only) to add review actions, sidebar badge addition alongside the existing pending-products badge.
- **Seller UI**: `features/seller` product create/edit/list components gain a verification banner and disabled "Publicar" state; `features/seller/legal-documents` gains rejection-reason display and re-upload affordance (if not already present).
- **Guards**: `core/guards/seller.guard.ts` currently checks role only — evaluate whether publish-blocking belongs in the guard, a route resolver, or purely in the service/RLS layer (recommend service/RLS layer; guard stays role-only).
