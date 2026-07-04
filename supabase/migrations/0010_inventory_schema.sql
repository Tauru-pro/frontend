-- ========================================================
-- 0010: Inventory management schema
-- Tables: inventory_items, inventory_movements
-- Trigger: sync_inventory_on_movement
-- ========================================================

-- ======== INVENTORY ITEMS ========

CREATE TABLE IF NOT EXISTS inventory_items (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid          NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  product_id         uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id          uuid          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  current_stock      int           NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_quantity int           NOT NULL DEFAULT 0 CHECK (min_stock_quantity >= 0),
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS inventory_items_tenant_idx ON inventory_items (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_items_product_idx ON inventory_items (product_id);
CREATE INDEX IF NOT EXISTS inventory_items_branch_idx ON inventory_items (branch_id);

CREATE TRIGGER set_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ======== INVENTORY MOVEMENTS ========

CREATE TABLE IF NOT EXISTS inventory_movements (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid          NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  inventory_item_id uuid          REFERENCES inventory_items(id) ON DELETE CASCADE,
  product_id        uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id         uuid          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  movement_type     text          NOT NULL
                      CHECK (movement_type IN ('ENTRY','EXIT','ADJUSTMENT','SALE','CANCELLATION')),
  quantity          int           NOT NULL CHECK (quantity > 0),
  delta             int           NOT NULL,
  resulting_balance int           NOT NULL CHECK (resulting_balance >= 0),
  notes             text,
  created_by        uuid          REFERENCES auth.users(id),
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON inventory_movements (inventory_item_id);
CREATE INDEX IF NOT EXISTS inventory_movements_tenant_idx ON inventory_movements (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements (product_id);

-- ======== TRIGGER: sync inventory on movement ========
-- Upserts inventory_items, updates current_stock, syncs products.stock_quantity

CREATE OR REPLACE FUNCTION sync_inventory_on_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock int;
  v_new_stock     int;
  v_total_stock   int;
BEGIN
  -- Upsert inventory_item for this (product_id, branch_id)
  INSERT INTO inventory_items (tenant_id, product_id, branch_id, current_stock)
  VALUES (NEW.tenant_id, NEW.product_id, NEW.branch_id, 0)
  ON CONFLICT (product_id, branch_id) DO NOTHING;

  -- Lock the row and get current stock
  SELECT current_stock INTO v_current_stock
  FROM inventory_items
  WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id
  FOR UPDATE;

  v_new_stock := v_current_stock + NEW.delta;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente: el stock actual es % y el movimiento requiere %', v_current_stock, ABS(NEW.delta);
  END IF;

  -- Set resulting_balance on the movement being inserted
  NEW.resulting_balance := v_new_stock;
  NEW.inventory_item_id := (
    SELECT id FROM inventory_items
    WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id
  );

  -- Update inventory_item current_stock
  UPDATE inventory_items
  SET current_stock = v_new_stock, updated_at = now()
  WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id;

  -- Sync products.stock_quantity as sum across all branches
  SELECT COALESCE(SUM(current_stock), 0) INTO v_total_stock
  FROM inventory_items
  WHERE product_id = NEW.product_id;

  UPDATE products
  SET stock_quantity = v_total_stock, updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_inventory_on_movement
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION sync_inventory_on_movement();

-- ======== RLS ========

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- inventory_items: seller reads/writes own tenant
CREATE POLICY seller_own_inventory_items ON inventory_items
  FOR ALL
  USING (
    tenant_id = (
      SELECT id FROM seller_profiles
      WHERE user_id = auth.uid()
    )
  );

-- inventory_items: super_admin reads all
CREATE POLICY admin_read_all_inventory_items ON inventory_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- inventory_movements: seller reads/inserts own tenant (no update/delete)
CREATE POLICY seller_own_inventory_movements_select ON inventory_movements
  FOR SELECT
  USING (
    tenant_id = (
      SELECT id FROM seller_profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY seller_own_inventory_movements_insert ON inventory_movements
  FOR INSERT
  WITH CHECK (
    tenant_id = (
      SELECT id FROM seller_profiles
      WHERE user_id = auth.uid()
    )
  );

-- inventory_movements: super_admin reads all
CREATE POLICY admin_read_all_inventory_movements ON inventory_movements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
