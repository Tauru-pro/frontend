-- ============================================================================
-- 0023_seller_verification_publishing
--
-- Replaces the per-product SUPER_ADMIN validation queue with a seller-level
-- legal verification gate:
--   * A verified seller (seller_profiles.status = 'ACTIVE') can publish their
--     own products straight to ACTIVE, no per-product admin review needed.
--   * A non-verified seller can keep creating/editing products, but can never
--     move one to ACTIVE themselves.
--   * seller_profiles.status flips PENDING -> ACTIVE automatically once both
--     required documents (RUT, LEGAL_REP) are APPROVED — done by the
--     seller-document-validate Edge Function (service_role), mirroring
--     product-validate.
--   * The public catalog (bull_listings / product_details views) and the
--     underlying RLS on products/product_media/bulls now also require the
--     owning seller to be verified, so a later-SUSPENDED seller's old ACTIVE
--     listings stop being served without needing a bulk product rewrite.
--
-- Pre-existing gap closed here in passing: seller_own_products /
-- seller_profiles_owner / seller_documents_owner are all FOR ALL policies
-- with no column-level restriction, so a SELLER could already self-set
-- products.status, seller_profiles.status or seller_documents.status
-- directly through PostgREST. RLS alone is row-level, not column-level
-- (same reasoning as protect_role_and_status in 0004), hence the triggers
-- below.
-- ============================================================================

-- ------------------------------------------------------- seller_documents ---

ALTER TABLE public.seller_documents
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Sellers still need to be able to re-upload a REJECTED (or any) document,
-- which resets it to PENDING_REVIEW and clears the previous rejection_reason
-- (see SellerDocumentService.uploadDocument) — that is not a review decision,
-- so it stays allowed. Only ADMIN/SUPER_ADMIN (or service_role) may move a
-- document to APPROVED/REJECTED or write a rejection_reason.
CREATE OR REPLACE FUNCTION public.protect_seller_document_review_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- service_role (the seller-document-validate Edge Function) bypasses RLS
  -- policies but not triggers, so it must be allowed explicitly.
  IF current_user = 'service_role' THEN
    RETURN new;
  END IF;

  IF (auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN') THEN
    RETURN new;
  END IF;

  IF new.status IS DISTINCT FROM old.status AND new.status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'Only ADMIN/SUPER_ADMIN can approve or reject a document';
  END IF;

  IF new.rejection_reason IS DISTINCT FROM old.rejection_reason AND new.rejection_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Only ADMIN/SUPER_ADMIN can set a document rejection reason';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS protect_seller_document_review_fields_trigger ON public.seller_documents;
CREATE TRIGGER protect_seller_document_review_fields_trigger
  BEFORE UPDATE ON public.seller_documents
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_document_review_fields();

-- -------------------------------------------------------- seller_profiles ---

-- Mirrors protect_role_and_status (0004) for seller_profiles.status: a SELLER
-- may edit their own business_name/description/etc., but never self-verify.
CREATE OR REPLACE FUNCTION public.protect_seller_profile_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'service_role' THEN
    RETURN new;
  END IF;

  IF (auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN') THEN
    RETURN new;
  END IF;

  IF new.status IS DISTINCT FROM old.status THEN
    RAISE EXCEPTION 'Only ADMIN/SUPER_ADMIN can change seller verification status';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS protect_seller_profile_status_trigger ON public.seller_profiles;
CREATE TRIGGER protect_seller_profile_status_trigger
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_profile_status();

-- -------------------------------------------------------------- products ----

-- A SELLER may only publish (status = 'ACTIVE') once their own seller profile
-- is verified. ADMIN/SUPER_ADMIN and service_role are unaffected, so the
-- legacy admin queue (product-validate) keeps working for any in-flight
-- PENDING_VALIDATION rows.
CREATE OR REPLACE FUNCTION public.enforce_product_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_seller_status text;
BEGIN
  IF current_user = 'service_role' THEN
    RETURN new;
  END IF;

  IF (auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN') THEN
    RETURN new;
  END IF;

  IF new.status = 'ACTIVE' THEN
    SELECT status INTO v_seller_status
      FROM public.seller_profiles
     WHERE id = new.tenant_id;

    IF v_seller_status IS DISTINCT FROM 'ACTIVE' THEN
      RAISE EXCEPTION 'SELLER_NOT_VERIFIED'
        USING hint = 'The seller must complete legal verification before publishing a product.';
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_publish_gate_trigger ON public.products;
CREATE TRIGGER enforce_product_publish_gate_trigger
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_publish_gate();

-- ---------------------------------------------- public read: verified only --

-- Same predicate everywhere a product/media/bull is exposed to anon/authenticated
-- readers: the product must be ACTIVE *and* its seller must be verified.

DROP POLICY IF EXISTS "public_read_active_products" ON products;
CREATE POLICY "public_read_active_products" ON products
  FOR SELECT
  USING (
    status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM public.seller_profiles sp
       WHERE sp.id = products.tenant_id
         AND sp.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "public_read_active_media" ON product_media;
CREATE POLICY "public_read_active_media" ON product_media
  FOR SELECT
  USING (
    (entity_type = 'product' AND EXISTS (
      SELECT 1 FROM products p
       JOIN public.seller_profiles sp ON sp.id = p.tenant_id
       WHERE p.id = product_media.entity_id
         AND p.status = 'ACTIVE'
         AND sp.status = 'ACTIVE'
    ))
    OR
    (entity_type = 'bull' AND EXISTS (
      SELECT 1 FROM products p
       JOIN public.seller_profiles sp ON sp.id = p.tenant_id
       WHERE p.bull_id = product_media.entity_id
         AND p.status = 'ACTIVE'
         AND sp.status = 'ACTIVE'
    ))
  );

DROP POLICY IF EXISTS "public_read_published_bulls" ON public.bulls;
CREATE POLICY "public_read_published_bulls" ON public.bulls
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.products p
     JOIN public.seller_profiles sp ON sp.id = p.tenant_id
     WHERE p.bull_id = bulls.id
       AND p.status = 'ACTIVE'
       AND sp.status = 'ACTIVE'
  ));

-- ------------------------------------------------------------------ views ---

-- Both views already join seller_profiles for business_name (0019/0022); the
-- seller-verified predicate slots in next to their existing p.status='ACTIVE'
-- filters. product_details' column list/order is unchanged from 0022, so
-- CREATE OR REPLACE is safe there. bull_listings gained `breed_slug` in 0021
-- (between breed_name and seller_id) — that column must stay or CREATE OR
-- REPLACE fails with "cannot drop columns from view" (42P16).

CREATE OR REPLACE VIEW public.bull_listings AS
SELECT
  b.id                AS bull_id,
  b.name              AS bull_name,
  b.is_featured       AS is_featured,
  br.id               AS breed_id,
  br.name             AS breed_name,
  br.slug             AS breed_slug,
  sp.id               AS seller_id,
  sp.business_name    AS seller_name,
  (
    SELECT m.storage_path
      FROM public.product_media m
     WHERE m.entity_type = 'bull'
       AND m.entity_id = b.id
       AND m.media_type = 'image'
     ORDER BY m.is_cover DESC, m.sort_order ASC NULLS LAST
     LIMIT 1
  )                   AS cover_path,
  min(p.price)        AS min_price,
  max(p.price)        AS max_price,
  max(p.created_at)   AS last_published_at,
  jsonb_agg(
    jsonb_build_object(
      'id',                 p.id,
      'name',               p.name,
      'straw_type',         p.straw_type,
      'price',              p.price,
      'min_order_quantity', p.min_order_quantity,
      'stock_quantity',     p.stock_quantity
    )
    ORDER BY p.price ASC
  )                   AS straws
FROM public.bulls b
JOIN public.products p
  ON p.bull_id = b.id
 AND p.status = 'ACTIVE'
JOIN public.seller_profiles sp
  ON sp.id = b.tenant_id
 AND sp.status = 'ACTIVE'
LEFT JOIN public.breeds br
  ON br.id = b.breed_id
GROUP BY b.id, b.name, b.is_featured, br.id, br.name, br.slug, sp.id, sp.business_name;

CREATE OR REPLACE VIEW public.product_details AS
SELECT
  p.id   AS product_id,
  b.id   AS bull_id,
  b.name AS bull_name,
  br.name AS breed_name,
  sp.id            AS seller_id,
  sp.business_name AS seller_name,

  COALESCE(
    (
      SELECT jsonb_agg(
               jsonb_build_object(
                 'id',           m.id,
                 'entity_type',  m.entity_type,
                 'entity_id',    m.entity_id,
                 'media_type',   m.media_type,
                 'storage_path', m.storage_path,
                 'mime_type',    m.mime_type,
                 'sort_order',   m.sort_order,
                 'is_cover',     m.is_cover,
                 'created_at',   m.created_at
               )
               ORDER BY m.sort_order ASC NULLS LAST, m.created_at ASC
             )
        FROM public.product_media m
       WHERE m.entity_type = 'bull'
         AND m.entity_id = b.id
    ),
    '[]'::jsonb
  ) AS bull_media,

  (
    SELECT jsonb_agg(
             jsonb_build_object(
               'id',                 v.id,
               'tenant_id',          v.tenant_id,
               'product_type',       v.product_type,
               'name',               v.name,
               'slug',               v.slug,
               'description',        v.description,
               'price',              v.price,
               'bull_id',            v.bull_id,
               'straw_type',         v.straw_type,
               'min_order_quantity', v.min_order_quantity,
               'stock_quantity',     v.stock_quantity,
               'status',             v.status,
               'created_at',         v.created_at,
               'updated_at',         v.updated_at,
               'media', COALESCE(
                 (
                   SELECT jsonb_agg(
                            jsonb_build_object(
                              'id',           m.id,
                              'entity_type',  m.entity_type,
                              'entity_id',    m.entity_id,
                              'media_type',   m.media_type,
                              'storage_path', m.storage_path,
                              'mime_type',    m.mime_type,
                              'sort_order',   m.sort_order,
                              'is_cover',     m.is_cover,
                              'created_at',   m.created_at
                            )
                            ORDER BY m.is_cover DESC, m.sort_order ASC NULLS LAST
                          )
                     FROM public.product_media m
                    WHERE m.entity_type = 'product'
                      AND m.entity_id = v.id
                 ),
                 '[]'::jsonb
               )
             )
             ORDER BY v.price ASC
           )
      FROM public.products v
     WHERE v.status = 'ACTIVE'
       AND (
         (p.bull_id IS NOT NULL AND v.bull_id = p.bull_id AND v.product_type = 'STRAW')
         OR
         (p.bull_id IS NULL AND v.id = p.id)
       )
  ) AS variants

FROM public.products p
LEFT JOIN public.bulls  b  ON b.id = p.bull_id
LEFT JOIN public.breeds br ON br.id = b.breed_id
JOIN public.seller_profiles sp ON sp.id = p.tenant_id
WHERE p.status = 'ACTIVE'
  AND sp.status = 'ACTIVE';

grant select on public.product_details to anon, authenticated;
grant select on public.bull_listings to anon, authenticated;
