-- ========================================================
-- 0009: Product catalog schema
-- Tables: bulls, products, product_media
-- ========================================================

-- ======== BULLS ========

CREATE TABLE IF NOT EXISTS bulls (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  breed_id       uuid        REFERENCES breeds(id),
  origin         text,
  registration_type text,
  code           text,
  description    text,
  status         text        NOT NULL DEFAULT 'DRAFT',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bulls_tenant_code_unique
  ON bulls (tenant_id, code) WHERE code IS NOT NULL;

CREATE TRIGGER set_bulls_updated_at
  BEFORE UPDATE ON bulls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ======== PRODUCTS ========

CREATE TABLE IF NOT EXISTS products (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid          NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  product_type        text          NOT NULL CHECK (product_type IN ('STRAW', 'SUPPLIES')),
  name                text          NOT NULL,
  slug                text          UNIQUE,
  description         text,
  price               numeric(14,2) NOT NULL,
  bull_id             uuid          REFERENCES bulls(id),
  straw_type          text,
  min_order_quantity  int           NOT NULL DEFAULT 1,
  stock_quantity      int           NOT NULL DEFAULT 0,
  status              text          NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','PENDING_VALIDATION','ACTIVE','REJECTED','CHANGES_REQUESTED','OUT_OF_STOCK','SUSPENDED')),
  validation_notes    text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_slug_unique
  ON products (tenant_id, slug) WHERE slug IS NOT NULL;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ======== PRODUCT_MEDIA ========

CREATE TABLE IF NOT EXISTS product_media (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text        NOT NULL CHECK (entity_type IN ('bull', 'product')),
  entity_id     uuid        NOT NULL,
  media_type    text        NOT NULL CHECK (media_type IN ('image', 'video', 'document')),
  storage_path  text        NOT NULL UNIQUE,
  mime_type     text,
  sort_order    smallint,
  is_cover      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ======== TRIGGERS ========

-- Enforce single cover per entity: when a row is set as cover,
-- unmark any existing cover for the same entity.
CREATE OR REPLACE FUNCTION enforce_single_cover()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_cover = true THEN
    UPDATE product_media
       SET is_cover = false
     WHERE entity_type = NEW.entity_type
       AND entity_id   = NEW.entity_id
       AND id          <> NEW.id
       AND is_cover    = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_cover_trigger
  BEFORE INSERT OR UPDATE ON product_media
  FOR EACH ROW EXECUTE FUNCTION enforce_single_cover();

-- Enforce max 3 images per entity (checked on INSERT only).
CREATE OR REPLACE FUNCTION check_max_images()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  img_count int;
BEGIN
  IF NEW.media_type = 'image' THEN
    SELECT COUNT(*) INTO img_count
      FROM product_media
     WHERE entity_type = NEW.entity_type
       AND entity_id   = NEW.entity_id
       AND media_type  = 'image';
    IF img_count >= 3 THEN
      RAISE EXCEPTION 'Maximum of 3 images allowed per entity';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_max_images_trigger
  BEFORE INSERT ON product_media
  FOR EACH ROW EXECUTE FUNCTION check_max_images();

-- ======== RLS ========

ALTER TABLE bulls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- BULLS: SELLER owns rows matching their tenant_id JWT claim
CREATE POLICY "seller_own_bulls" ON bulls
  FOR ALL
  USING      ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id)
  WITH CHECK ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id);

-- BULLS: ADMIN / SUPER_ADMIN can read all
CREATE POLICY "admin_read_all_bulls" ON bulls
  FOR SELECT
  USING ((auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN'));

-- PRODUCTS: SELLER owns rows matching their tenant_id JWT claim
CREATE POLICY "seller_own_products" ON products
  FOR ALL
  USING      ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id)
  WITH CHECK ((auth.jwt() ->> 'tenant_id')::uuid = tenant_id);

-- PRODUCTS: ADMIN / SUPER_ADMIN can read all
CREATE POLICY "admin_read_all_products" ON products
  FOR SELECT
  USING ((auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN'));

-- PRODUCTS: SUPER_ADMIN can update validation status on any product
CREATE POLICY "admin_update_products_status" ON products
  FOR UPDATE
  USING      ((auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN'))
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN'));

-- PRODUCTS: public can read ACTIVE products (unauthenticated catalog)
CREATE POLICY "public_read_active_products" ON products
  FOR SELECT
  USING (status = 'ACTIVE');

-- PRODUCT_MEDIA: SELLER can manage media for their own bulls/products
CREATE POLICY "seller_own_media" ON product_media
  FOR ALL
  USING (
    (entity_type = 'bull' AND EXISTS (
      SELECT 1 FROM bulls
       WHERE id = product_media.entity_id
         AND (auth.jwt() ->> 'tenant_id')::uuid = tenant_id
    ))
    OR
    (entity_type = 'product' AND EXISTS (
      SELECT 1 FROM products
       WHERE id = product_media.entity_id
         AND (auth.jwt() ->> 'tenant_id')::uuid = tenant_id
    ))
  )
  WITH CHECK (
    (entity_type = 'bull' AND EXISTS (
      SELECT 1 FROM bulls
       WHERE id = product_media.entity_id
         AND (auth.jwt() ->> 'tenant_id')::uuid = tenant_id
    ))
    OR
    (entity_type = 'product' AND EXISTS (
      SELECT 1 FROM products
       WHERE id = product_media.entity_id
         AND (auth.jwt() ->> 'tenant_id')::uuid = tenant_id
    ))
  );

-- PRODUCT_MEDIA: ADMIN / SUPER_ADMIN can read all media
CREATE POLICY "admin_read_all_media" ON product_media
  FOR SELECT
  USING ((auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN'));

-- PRODUCT_MEDIA: public can read media for ACTIVE products / bulls with ACTIVE products
CREATE POLICY "public_read_active_media" ON product_media
  FOR SELECT
  USING (
    (entity_type = 'product' AND EXISTS (
      SELECT 1 FROM products WHERE id = product_media.entity_id AND status = 'ACTIVE'
    ))
    OR
    (entity_type = 'bull' AND EXISTS (
      SELECT 1 FROM products WHERE bull_id = product_media.entity_id AND status = 'ACTIVE'
    ))
  );
