## Context

Los productos en `products.stock_quantity` tienen un entero editable directamente por el vendedor, sin historial de dónde viene ese stock ni qué sucursal lo tiene. Las sucursales (`branches`) ya están implementadas (migración 0007) pero no hay ninguna relación con inventario. El objetivo es reemplazar esa gestión ad-hoc con un sistema de ledger inmutable particionado por sucursal, preservando el campo `stock_quantity` como proyección de solo lectura calculada por trigger.

## Goals / Non-Goals

**Goals:**
- Tablas `inventory_items` (stock actual por producto+sucursal) e `inventory_movements` (ledger inmutable, solo INSERT)
- Trigger que mantiene `inventory_items.current_stock` y sincroniza `products.stock_quantity` como suma total
- RLS por tenant en ambas tablas; SUPER_ADMIN lee todo
- UI vendedor: lista de ítems de inventario, formulario de movimiento, historial de movimientos
- UI backoffice: vista de inventario global (solo lectura)
- Alerta visual en el frontend cuando `current_stock ≤ min_stock_quantity`

**Non-Goals:**
- Notificaciones por email (Módulo 10)
- Reservas temporales de stock durante checkout (Módulo 7)
- Transferencias entre sucursales (separado, puede añadirse después)
- Integración con flujo de pago o decremento automático al vender (Módulo 8)

## Decisions

### D1 — Ledger inmutable con proyección en inventory_items

**Decisión:** Los movimientos solo se insertan nunca se modifican. El trigger `sync_inventory_on_movement` calcula el nuevo `current_stock` en `inventory_items` tras cada INSERT y propaga la suma total a `products.stock_quantity`.

**Alternativas consideradas:**
- Mantener solo `products.stock_quantity` editable → No hay historial, no hay partición por sucursal.
- Calcular stock en tiempo real sumando movements → Costoso para catálogo público que necesita filtrar por `stock > 0`.

**Rationale:** La proyección denormalizada en `inventory_items.current_stock` y `products.stock_quantity` es O(1) para lecturas del catálogo y evita recálculos. El ledger en `inventory_movements` garantiza auditoría completa.

### D2 — Un ítem de inventario por (producto, sucursal)

**Decisión:** `inventory_items` tiene unique constraint `(product_id, branch_id)`. Si el vendedor registra un movimiento para un producto en una sucursal que no tiene ítem aún, el trigger crea el ítem con `current_stock = delta`.

**Alternativas consideradas:**
- Obligar al vendedor a crear el ítem antes del primer movimiento → UX más compleja sin beneficio técnico.

**Rationale:** El UI puede mostrar "agregar inventario en sucursal" que crea implícitamente el ítem via el primer movimiento de tipo `ENTRY`.

### D3 — stock_quantity en products como campo derivado (solo lectura)

**Decisión:** El trigger `sync_inventory_on_movement` actualiza `products.stock_quantity = SUM(inventory_items.current_stock)` filtrando por `product_id`. El formulario de producto elimina el campo `stockQuantity` editable.

**Alternativas consideradas:**
- Mantener `stock_quantity` editable y duplicado → Estado inconsistente garantizado.
- Eliminar `stock_quantity` de products y recalcular en queries → Rompe filtros de catálogo (`stock > 0`) que no pueden hacer JOINs complejos en lectura pública.

**Rationale:** Campo derivado es el patrón correcto: escritura controlada por trigger, lectura directa en catálogo.

### D4 — Tipos de movimiento como enum de PostgreSQL

**Decisión:** `movement_type` es `CHECK (movement_type IN ('ENTRY', 'EXIT', 'ADJUSTMENT', 'SALE', 'CANCELLATION'))`. El delta puede ser positivo o negativo según el tipo; el UI valida que EXIT/SALE envíen delta negativo y ENTRY positivo.

**Rationale:** Sin enum de PG nativo para mantener la migración simple y compatible con `isolatedModules` del frontend TypeScript.

### D5 — Alertas de stock mínimo como estado derivado en frontend

**Decisión:** No hay tabla de alertas ni función de cron. El frontend calcula `isLowStock = current_stock ≤ min_stock_quantity` al renderizar la lista de inventory_items. Un badge visual rojo/amarillo advierte al vendedor.

**Alternativas consideradas:**
- Trigger que inserta en tabla `alerts` → Requiere Módulo 10 (notificaciones), desbordamiento de scope.
- Edge Function cron que envía email → Módulo 10, fuera de scope.

**Rationale:** La alerta visual cubre RF-015 de forma mínima y funcional sin acoplarse a Módulo 10.

### D6 — Rutas Angular y lazy loading

**Decisión:**
- Vendedor: `/seller/inventory` (lista) y `/seller/inventory/:itemId` (detalle + historial + formulario movimiento)
- Backoffice: `/admin/inventory` (vista global)

Ambas áreas usan `loadComponent` con default export, siguiendo el patrón existente de `seller-routes.ts` y `backoffice-routes.ts`.

## Risks / Trade-offs

- **Race condition en trigger**: Si dos movimientos se insertan simultáneamente para el mismo `(product_id, branch_id)`, el `current_stock` calculado puede ser incorrecto. → Mitigación: usar `FOR UPDATE` en el SELECT del trigger dentro de la transacción. PostgreSQL garantiza serialización a nivel de fila.
- **Stock negativo**: Un EXIT con más unidades de las disponibles dejaría `current_stock < 0`. → Mitigación: CHECK constraint `current_stock >= 0` en `inventory_items` rechaza el insert del movimiento (rollback de la transacción); el UI muestra el error al vendedor.
- **products.stock_quantity desincronizado**: Si se manipula `inventory_items.current_stock` directamente (bypass del trigger), el total en products quedará mal. → Mitigación: RLS no permite UPDATE en `inventory_items.current_stock` desde el cliente; el campo solo lo modifica el trigger (con `security definer`).
- **Rendimiento del SUM en products**: Para vendedores con muchas sucursales (>50), el trigger recalcula el SUM en cada movimiento. → Aceptable en MVP; si se convierte en cuello de botella, se puede cachear con un view materializado.

## Migration Plan

1. Aplicar `0010_inventory_schema.sql` (tablas, trigger, RLS) — no rompe datos existentes.
2. Ejecutar script de seed: para cada product existente con `stock_quantity > 0`, insertar un `inventory_movement` de tipo `ENTRY` en la primera sucursal del tenant (o sin sucursal si el tenant no tiene branches aún). Esto inicializa el ledger sin perder el dato existente.
3. Deploy del frontend: el formulario de producto ya no muestra `stockQuantity` (BREAKING para usuarios que editan productos, pero el valor se preserva vía trigger).

**Rollback:** Si se revierte la migración, `products.stock_quantity` recupera su valor estático. Los datos del ledger pueden retenerse o eliminarse con DROP TABLE en cascada.
