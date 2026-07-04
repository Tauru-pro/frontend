## Why

Los productos actuales almacenan `stock_quantity` como un campo editable directo en la tabla `products`, sin historial de movimientos ni partición por sucursal. Módulo 6 introduce el inventario descentralizado por sucursal con ledger inmutable, cumpliendo RF-013/RF-014/RF-015 del spec de proyecto y habilitando la gestión operacional real de stock criogénico que los vendedores necesitan para operar.

## What Changes

- **Nuevas tablas en Supabase**: `inventory_items` (stock actual por producto+sucursal con umbral de alerta) e `inventory_movements` (ledger inmutable — nunca se edita, solo se inserta).
- **Trigger automático**: Al insertar en `inventory_movements`, el trigger actualiza `inventory_items.current_stock` y sincroniza `products.stock_quantity` como suma total entre sucursales.
- **UI Vendedor — Inventario por sucursal**: Nueva sección `/seller/inventory` con lista de ítems de inventario, formulario para registrar movimientos (Entrada / Salida / Ajuste), y vista de historial de movimientos por ítem.
- **UI Vendedor — Configurar umbral de stock mínimo**: El vendedor define `min_stock_quantity` por ítem; cuando `current_stock ≤ min_stock_quantity` se muestra una alerta visual en el dashboard.
- **UI Backoffice — Vista de inventario global**: El `SUPER_ADMIN` puede ver el inventario agregado de todos los tenants con filtros por tenant, sucursal y producto.
- **`products.stock_quantity` pasa a ser solo lectura para el vendedor**: Su valor lo mantiene el trigger; el vendedor ya no lo edita manualmente en el formulario de producto.
- **BREAKING**: El campo `stock_quantity` del formulario de producto (`/seller/products/new` y `edit`) se elimina del paso 1 del formulario y pasa a gestionarse exclusivamente desde `/seller/inventory`.

## Capabilities

### New Capabilities

- `inventory-management`: Control de stock descentralizado por sucursal con ledger inmutable (inventory_items + inventory_movements), alertas de stock mínimo, y vistas de inventario para vendedor y super-admin.

### Modified Capabilities

- `product-catalog`: El campo `stock_quantity` en el formulario de creación/edición de producto deja de ser editable por el vendedor. Su valor se calcula automáticamente como suma de `inventory_items.current_stock` para todas las sucursales del tenant via trigger. Los formularios de producto (seller) ya no exponen este campo.

## Impact

- **Nueva migración SQL** (`0010_inventory_schema.sql`): tablas `inventory_items`, `inventory_movements`, trigger de sincronización, RLS por tenant.
- **Nuevos componentes Angular**: `src/app/features/seller/inventory/` (inventory-list, inventory-detail, movement-form).
- **Nuevo componente backoffice**: `src/app/features/backoffice/inventory/` (inventory-overview).
- **Nuevo service/model**: `core/services/inventory.service.ts`, `core/models/inventory.model.ts`.
- **Modificación**: `src/app/features/seller/products/product-form.component.ts` — eliminar campo `stockQuantity` del paso 1.
- **Modificación**: `src/app/core/models/product.model.ts` / `product.service.ts` — marcar `stock_quantity` como campo derivado (solo lectura).
- **Rutas**: añadir `/seller/inventory` y `/seller/inventory/:id` a `seller-routes.ts`; añadir `/admin/inventory` a `backoffice-routes.ts`.
- **Dependencias**: requiere que `branches` estén implementadas (migración 0007 ya aplicada).
