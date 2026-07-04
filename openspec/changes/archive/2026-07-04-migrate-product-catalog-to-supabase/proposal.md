## Why

El catálogo de productos (toros/pajillas e insumos ganaderos) es el núcleo comercial de Tauru. Hoy sigue atado al backend NestJS legacy: `BullService`, `ProductService` y `SupplyService` llaman a `environment.apiUrl` con `HttpClient`, y las rutas de productos (`/seller/products`) no existen en Angular. Este módulo migra el catálogo completo a Supabase — tablas, RLS, media (Supabase Storage), flujo de validación y UI — haciendo que el SELLER pueda gestionar su catálogo y el SUPER_ADMIN pueda auditar productos sin depender del backend NestJS.

## What Changes

- **Nuevas migraciones Supabase** (`0009_product_catalog_schema.sql`): tablas `bulls`, `products`, `product_media`; RLS por `tenant_id` JWT claim; trigger `enforce_single_cover_per_product`; bucket de Supabase Storage `product-media` con RLS
- **Reescritura de `BullService`**: supabase-js en lugar de HttpClient; CRUD de toros + gestión de pajillas (straws embebidas como JSONB o subtabla)
- **Reescritura de `ProductService`**: supabase-js; CRUD de productos tipo STRAW (ligado a toro) y SUPPLIES (independiente); gestión de media vía Supabase Storage
- **Reescritura de `SupplyService`**: los insumos pasan a ser `products` con `product_type = 'SUPPLIES'` en la misma tabla; eliminar el modelo Supply separado
- **Flujo de validación**: SELLER envía producto → `PENDING_VALIDATION`; SUPER_ADMIN aprueba (`ACTIVE`) / rechaza (`REJECTED`) / solicita cambios (`CHANGES_REQUESTED`) desde `/admin/products`
- **Nuevas rutas y componentes**: `/seller/products`, `/seller/products/new`, `/seller/products/:id/edit`; vista de auditoría `/admin/products`
- **Actualización de componentes existentes**: `bull-list`, `bull-form`, `supply-list`, `supply-form` migrados al nuevo contrato de Supabase

## Capabilities

### New Capabilities
- `bull-management`: SELLER crea y gestiona toros reproductores (raza, origen, tipo de registro) con media multimedia (hasta 3 imágenes + 1 video)
- `product-catalog`: SELLER crea pajillas (STRAW, ligadas a toros) e insumos (SUPPLIES) con precio, stock, media y SKU; catálogo público de productos activos
- `product-validation`: flujo de auditoría PENDING_VALIDATION → ACTIVE/REJECTED/CHANGES_REQUESTED gestionado por SUPER_ADMIN

### Modified Capabilities
- `branch-management`: ningún cambio de requisitos (la FK `city_id` ya estaba en el modelo)

## Impact

- **Nuevas migraciones**: `supabase/migrations/0009_product_catalog_schema.sql`
- **Servicios reescritos**: `core/services/bull.service.ts`, `core/services/product.service.ts`, `core/services/supply.service.ts` (supply folded into product)
- **Nuevos modelos actualizados**: `core/models/bull.model.ts`, `core/models/product.model.ts`; `supply.model.ts` deprecado (Supply = Product tipo SUPPLIES)
- **Nuevos componentes**: `features/seller/products/product-list.component.ts`, `features/seller/products/product-form.component.ts`; `features/backoffice/products/products.component.ts`
- **Rutas actualizadas**: `features/seller/seller-routes.ts` (agregar `/products`), `features/backoffice/backoffice-routes.ts` (agregar `/products`)
- **Supabase Storage**: bucket `product-media` con políticas de acceso por tenant
- Sin cambios en guards ni en el interceptor de autenticación
