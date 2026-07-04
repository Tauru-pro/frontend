## 1. Base de Datos

- [x] 1.1 Crear migración `supabase/migrations/0010_inventory_schema.sql` con tablas `inventory_items` e `inventory_movements`, check constraints, índices y trigger `sync_inventory_on_movement`
- [x] 1.2 Definir RLS en `inventory_items`: vendedor lee/escribe su tenant, SUPER_ADMIN lee todo
- [x] 1.3 Definir RLS en `inventory_movements`: vendedor lee/inserta su tenant, SUPER_ADMIN lee todo (sin UPDATE ni DELETE)
- [x] 1.4 Aplicar la migración en el proyecto de Supabase (requiere credenciales — aplicar manualmente vía SQL Editor o Management API)

## 2. Modelos y Servicios

- [x] 2.1 Crear `src/app/core/models/inventory.model.ts` con interfaces `InventoryItem`, `InventoryMovement`, `CreateMovementDto`, `UpdateInventoryItemDto`, y tipos `MovementType`
- [x] 2.2 Crear `src/app/core/services/inventory.service.ts` con métodos: `getMyInventoryItems()`, `getInventoryItem(id)`, `getMovements(itemId)`, `createMovement(dto)`, `updateMinStock(itemId, minStock)`, `getAllInventoryItems()` (SUPER_ADMIN)

## 3. UI Vendedor — Lista de Inventario

- [x] 3.1 Crear `src/app/features/seller/inventory/inventory-list.component.ts` como componente standalone con tabla de ítems, badge de bajo stock (`current_stock ≤ min_stock_quantity`) y botón "Agregar movimiento"
- [x] 3.2 Añadir ruta `/seller/inventory` en `src/app/features/seller/seller-routes.ts` apuntando al componente con `default export`

## 4. UI Vendedor — Detalle + Historial + Formulario de Movimiento

- [x] 4.1 Crear `src/app/features/seller/inventory/inventory-detail.component.ts` con historial de movimientos (tabla ordenada desc), datos del ítem y formulario inline para registrar un nuevo movimiento
- [x] 4.2 El formulario de movimiento debe validar: tipo ENTRY/CANCELLATION → cantidad positiva; tipo EXIT/SALE → cantidad ≤ `current_stock`; tipo ADJUSTMENT → libre
- [x] 4.3 Añadir ruta `/seller/inventory/:itemId` en `seller-routes.ts` apuntando al componente
- [x] 4.4 Añadir entrada de menú "Inventario" en el sidebar del layout backoffice (seller area) y enlace desde la lista de productos

## 5. UI Backoffice — Vista Global

- [x] 5.1 Crear `src/app/features/backoffice/inventory/inventory-overview.component.ts` como componente de solo lectura que llama a `inventoryService.getAllInventoryItems()` con filtros por tenant y sucursal
- [x] 5.2 Añadir ruta `/admin/inventory` en `src/app/features/backoffice/backoffice-routes.ts`
- [x] 5.3 Añadir entrada "Inventario" en el sidebar del layout backoffice (admin area)

## 6. Modificación al Formulario de Producto

- [x] 6.1 En `src/app/features/seller/products/product-form.component.ts`, eliminar el campo `stockQuantity` del paso 1 del formulario (tanto del template como del model signal y del DTO de creación)
- [x] 6.2 En `src/app/core/models/product.model.ts`, marcar `stockQuantity` como campo solo lectura en la interfaz `Product` y eliminarlo de `CreateProductDto` y `UpdateProductDto`
- [x] 6.3 En `src/app/core/services/product.service.ts`, eliminar `stock_quantity` del INSERT de `createProduct` (el trigger lo inicializa en 0; el valor lo gestiona el inventario)

## 7. SSR — Rutas de servidor

- [x] 7.1 Añadir `/seller/inventory/:itemId` y `/admin/inventory` a `src/app/app.routes.server.ts` con `RenderMode.Server` para evitar fallos de prerender con IDs dinámicos

## 8. Verificación Manual

- [ ] 8.1 Crear un producto STRAW: confirmar que no aparece el campo `stock_quantity` en el formulario
- [ ] 8.2 Registrar un movimiento ENTRY (50 unidades) para ese producto en una sucursal: verificar que `inventory_items.current_stock = 50` y `products.stock_quantity = 50`
- [ ] 8.3 Registrar un movimiento EXIT (10 unidades): verificar que `current_stock = 40` y `products.stock_quantity = 40`
- [ ] 8.4 Intentar EXIT de 100 unidades: verificar que el sistema rechaza con error de stock insuficiente
- [ ] 8.5 Configurar `min_stock_quantity = 45` y verificar que el badge de bajo stock aparece en la lista
- [ ] 8.6 Como SUPER_ADMIN, verificar que `/admin/inventory` muestra ítems de todos los tenants
- [ ] 8.7 Como vendedor B, verificar que no puede ver el inventario del vendedor A (aislamiento RLS)
