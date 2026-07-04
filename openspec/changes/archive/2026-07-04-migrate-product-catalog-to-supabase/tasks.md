## 1. Esquema de base de datos (migración 0009)

- [ ] 1.1 Crear `supabase/migrations/0009_product_catalog_schema.sql`: tabla `bulls` (`id` uuid PK, `tenant_id` uuid FK→`seller_profiles.id` ON DELETE CASCADE, `name` text NOT NULL, `breed_id` uuid FK→`breeds.id`, `origin` text, `registration_type` text, `code` text, `description` text, `status` text DEFAULT 'DRAFT', `created_at`, `updated_at`; unique(`tenant_id`, `code`) where code is not null)
- [ ] 1.2 En la misma migración: tabla `products` (`id` uuid PK, `tenant_id` uuid FK→`seller_profiles.id` ON DELETE CASCADE, `product_type` text NOT NULL CHECK IN ('STRAW','SUPPLIES'), `name` text NOT NULL, `slug` text UNIQUE, `description` text, `price` numeric(14,2) NOT NULL, `bull_id` uuid FK→`bulls.id` (nullable, requerido cuando product_type='STRAW'), `straw_type` text (nullable), `min_order_quantity` int DEFAULT 1, `stock_quantity` int DEFAULT 0, `status` text DEFAULT 'DRAFT' CHECK IN ('DRAFT','PENDING_VALIDATION','ACTIVE','REJECTED','CHANGES_REQUESTED','OUT_OF_STOCK','SUSPENDED'), `validation_notes` text, `created_at`, `updated_at`; unique(`tenant_id`, `slug`))
- [ ] 1.3 En la misma migración: tabla `product_media` (`id` uuid PK, `entity_type` text NOT NULL CHECK IN ('bull','product'), `entity_id` uuid NOT NULL, `media_type` text NOT NULL CHECK IN ('image','video','document'), `storage_path` text NOT NULL UNIQUE, `mime_type` text, `sort_order` smallint, `is_cover` boolean DEFAULT false, `created_at`)
- [ ] 1.4 En la misma migración: trigger `set_updated_at` en `bulls` y `products`; trigger `enforce_single_cover` en `product_media` (when is_cover=true, unsets previous cover for same entity); constraint: máximo 3 imágenes por entidad (function + constraint CHECK via trigger)
- [ ] 1.5 En la misma migración: RLS en `bulls` — owner policy (`(auth.jwt() ->> 'tenant_id')::uuid = tenant_id` para ALL) + admin SELECT policy; RLS en `products` — misma estructura + política adicional: SELLER solo puede actualizar `status` de DRAFT→PENDING_VALIDATION o de CHANGES_REQUESTED→PENDING_VALIDATION; RLS en `product_media` — owner via JOIN a `bulls`/`products` según `entity_type`; política pública SELECT para `status = 'ACTIVE'` en `products`
- [x] 1.6 Aplicar la migración `0009` contra el proyecto Supabase real (pedir credenciales al usuario)

## 2. Supabase Storage

- [x] 2.1 Crear bucket `product-media` via Supabase Management API: `POST /v1/projects/{ref}/storage/buckets` con `{ "id": "product-media", "name": "product-media", "public": false }`
- [x] 2.2 Agregar políticas Storage RLS: SELLER puede INSERT/SELECT/DELETE en rutas `{tenant_id}/**`; SUPER_ADMIN puede SELECT en todo el bucket; público puede SELECT en rutas de productos ACTIVE (policy via SQL en `storage.objects`)

## 3. Modelos Angular actualizados

- [ ] 3.1 Actualizar `src/app/core/models/bull.model.ts`: agregar campo `tenantId: string`; usar `BullStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED'`; quitar `sellerId` (renombrar a `tenantId`); actualizar `CreateBullDto`/`UpdateBullDto`
- [ ] 3.2 Actualizar `src/app/core/models/product.model.ts`: `ProductStatus` agrega `'CHANGES_REQUESTED'`; agregar campo `tenantId: string`; agregar `validationNotes?: string`; quitar `sellerId`; actualizar DTOs
- [ ] 3.3 Agregar interfaz `ProductMedia` en `product.model.ts`: `{ id, entityType, entityId, mediaType, storagePath, mimeType, sortOrder, isCover, createdAt }`

## 4. BullService (reescritura)

- [ ] 4.1 Reescribir `src/app/core/services/bull.service.ts` con supabase-js: `getMyBulls(page, limit, status?)`: Observable wrapping query con join `breeds(id, name)`, filtro RLS automático por tenant; `getBull(id)`: Observable con join `breeds`, `product_media` (entity_type='bull')
- [ ] 4.2 En el mismo servicio: `createBull(dto)`: async; resuelve `tenant_id` via `getJwtClaim`; inserta en `bulls`; `updateBull(id, dto)`: async; `deleteBull(id)`: async (solo si no hay productos ACTIVE ligados)
- [ ] 4.3 En el mismo servicio: `uploadBullMedia(bullId, file, mediaType)`: async; upload a Supabase Storage en ruta `{tenant_id}/bulls/{bullId}/{filename}`; inserta registro en `product_media`; `setCoverImage(bullId, mediaId)`: async; `deleteMedia(mediaId)`: async (borra de Storage y de `product_media`)

## 5. ProductService (reescritura)

- [ ] 5.1 Reescribir `src/app/core/services/product.service.ts` con supabase-js: `getMyProducts(page, limit, productType?, status?)`: Observable wrapping query con join `bulls(id, name)`, `product_media`; `getProduct(id)`: Observable con joins completos
- [ ] 5.2 En el mismo servicio: `createProduct(dto)`: async; resuelve `tenant_id`; genera `slug` (nombre en kebab-case + random suffix); inserta; `updateProduct(id, dto)`: async; `deleteProduct(id)`: async (solo si status=DRAFT o REJECTED)
- [ ] 5.3 En el mismo servicio: `submitForValidation(id)`: async; `update({ status: 'PENDING_VALIDATION' }).eq('id', id)`; `resubmitAfterChanges(id)`: idem
- [ ] 5.4 En el mismo servicio: `uploadProductMedia(productId, file)`: async; upload a Storage en `{tenant_id}/products/{productId}/{filename}`; inserta en `product_media`; `setCoverImage(productId, mediaId)`: async; `deleteMedia(mediaId)`: async
- [ ] 5.5 Eliminar `src/app/core/services/supply.service.ts` (supplies son products con type='SUPPLIES'); actualizar imports en componentes que lo inyecten

## 6. Componentes y rutas SELLER — Toros

- [ ] 6.1 Actualizar `src/app/features/seller/bulls/bull-list.component.ts`: cambiar `firstValueFrom(bullService.getMyBulls(...))` o Observable subscribe por el nuevo contrato; mostrar badge de estado; agregar columna de breed
- [ ] 6.2 Actualizar `src/app/features/seller/bulls/bull-form.component.ts`: usar `SearchSelectComponent` para elegir raza (`BreedService.getAll()`); cambiar submit a `await bullService.createBull(dto)` / `await bullService.updateBull(id, dto)`; agregar sección de carga de imágenes (input file + preview + botón de cover)

## 7. Componentes y rutas SELLER — Productos

- [ ] 7.1 Crear `src/app/features/seller/products/product-list.component.ts`: tabla con columnas nombre, tipo (STRAW/SUPPLIES), precio, stock, estado, acciones; badge de estado coloreado (DRAFT=gris, PENDING=amarillo, ACTIVE=verde, REJECTED=rojo, CHANGES_REQUESTED=naranja); botón "Enviar para revisión" en productos DRAFT; mismo patrón que `branch-list.component.ts`
- [ ] 7.2 Crear `src/app/features/seller/products/product-form.component.ts`: selector de tipo (STRAW/SUPPLIES); campos condicionales: si STRAW → selector de toro (`SearchSelectComponent` con `bullService.getMyBulls`), tipo de pajilla, cantidad mínima; si SUPPLIES → campos estándar; campos comunes: nombre, precio, stock, SKU, descripción; sección de media (hasta 3 imágenes, con selección de cover); validaciones con `@angular/forms/signals`
- [ ] 7.3 Actualizar `src/app/features/seller/seller-routes.ts`: agregar rutas `{ path: 'products', loadComponent: ... }`, `{ path: 'products/new', ... }`, `{ path: 'products/:id/edit', ... }`; actualizar redirect default de `''` a `products`
- [ ] 7.4 Actualizar rutas de supplies en `seller-routes.ts`: `supply-list` y `supply-form` ahora usan `ProductService` con `product_type = 'SUPPLIES'`; actualizar los componentes `supply-list.component.ts` y `supply-form.component.ts` para inyectar `ProductService` en lugar de `SupplyService`

## 8. Componente y rutas ADMIN — Validación

- [ ] 8.1 Crear `src/app/features/backoffice/products/products.component.ts`: lista de productos en PENDING_VALIDATION de todos los tenants; columnas: nombre del producto, tipo, vendedor, fecha de envío; acciones: Aprobar, Rechazar (pide motivo en modal), Solicitar cambios (pide comentario en modal); mismo patrón visual que `sellers.component.ts`
- [ ] 8.2 Actualizar `src/app/features/backoffice/backoffice-routes.ts`: agregar `{ path: 'products', loadComponent: () => import('./products/products.component'), canActivate: [superAdminGuard] }`

## 9. Verificación

- [x] 9.1 `ng build` sin errores de tipos
- [ ] 9.2 Como SELLER: crear un toro con raza, subir imagen, confirmar que aparece en `/seller/bulls`
- [ ] 9.3 Como SELLER: crear un producto STRAW ligado al toro, subir imagen, enviarlo a revisión → estado PENDING_VALIDATION
- [ ] 9.4 Como SELLER: crear un producto SUPPLIES, verificar que aparece en `/seller/supplies`
- [ ] 9.5 Como SUPER_ADMIN: ir a `/admin/products`, aprobar el producto STRAW → estado ACTIVE
- [ ] 9.6 Como SUPER_ADMIN: rechazar un producto con motivo → SELLER puede ver el motivo de rechazo en su lista
- [ ] 9.7 Verificar aislamiento: SELLER B no puede ver ni editar productos de SELLER A
