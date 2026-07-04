## Context

El backend NestJS tiene las tablas `bulls`, `products` y `product_media` en su propia base de datos TypeORM. El frontend llama esas APIs via `HttpClient`. Esta migración replica esas tablas en Supabase con RLS, reescribe los tres servicios Angular para usar `supabase-js`, integra Supabase Storage para media, implementa el flujo de validación, y crea los componentes de producto que hoy no existen.

Módulos ya completados que establecen patrones reutilizables: `tenant_id` claim en JWT (módulo 2), RLS por tenant (módulo 3), `getJwtClaim()` helper, Observable-wrapping para reads, async/await para mutations, `set_updated_at()` trigger function.

## Goals / Non-Goals

**Goals:**
- Migración `0009_product_catalog_schema.sql`: tablas `bulls`, `products`, `product_media` con RLS y constraints
- Supabase Storage bucket `product-media` con políticas de acceso por tenant
- Reescritura de `BullService`, `ProductService`; fold de `SupplyService` en `ProductService`
- Nuevos componentes: `product-list`, `product-form` (SELLER); `products.component.ts` (backoffice/SUPER_ADMIN)
- Actualización de `bull-list`, `bull-form` para el nuevo contrato Supabase
- Flujo de validación: DRAFT → PENDING_VALIDATION (SELLER) → ACTIVE/REJECTED/CHANGES_REQUESTED (SUPER_ADMIN)
- PDFs de registro genealógico, árbol de pedigrí y evaluación andrológica para bulls (Supabase Storage)

**Non-Goals:**
- Inventario por sucursal (pertenece a Módulo 6)
- Checkout / carrito (ya existe en NestJS, se migrará en módulo posterior)
- Catálogo público marketplace (módulo marketplace)
- Videos de más de 100 MB (límite de Supabase Storage gratuito, diferir compresión)

## Decisions

### D1: `supplies` → `products` con `product_type = 'SUPPLIES'`
**Decisión:** No hay tabla `supplies` separada. Los insumos son `products` con `product_type = 'SUPPLIES'`, exactamente como el backend NestJS. El modelo `Supply` en el frontend queda deprecado; todos los insumos se manejan a través de `ProductService`.
**Razón:** Evita duplicar lógica de validación, media y RLS. Coincide con el esquema NestJS ya diseñado.

### D2: Supabase Storage para media (no S3)
**Decisión:** Bucket `product-media` en Supabase Storage. Upload directo desde el browser con token JWT del SELLER (RLS en el bucket). La ruta de cada archivo es `{tenant_id}/{product_id_or_bull_id}/{filename}`.
**Alternativa considerada:** AWS S3 con presigned URLs del backend NestJS.
**Razón:** Elimina la dependencia AWS en el frontend; la autenticación reutiliza el mismo JWT de Supabase Auth ya configurado.

### D3: `product_media` como tabla SQL (no JSONB)
**Decisión:** Tabla `product_media` normalizada con `entity_type` ('bull'|'product') y `entity_id` uuid, igual que el diseño NestJS.
**Razón:** Permite RLS granular, joins eficientes, y constraints (límite de 3 imágenes + 1 video por entidad, 1 cover).

### D4: `validation_notes` directamente en `products`
**Decisión:** Columna `validation_notes text` en `products` para el motivo de rechazo o comentario de cambios. No se crea tabla de historial de auditoría en MVP.
**Alternativa considerada:** Tabla `product_audit_log` separada.
**Razón:** Suficiente para MVP. El historial completo se puede agregar en una iteración posterior.

### D5: Status machine en RLS (no triggers)
**Decisión:** Transiciones de estado controladas por RLS: SELLER solo puede escribir campos de contenido cuando `status IN ('DRAFT','CHANGES_REQUESTED')`; cambios de `status` solo los puede hacer SUPER_ADMIN (política `with check` restrictiva) o el propio SELLER para `DRAFT → PENDING_VALIDATION`.
**Razón:** Más simple que triggers para el MVP; el check de transición inválida se hace en el cliente Angular antes de llamar a Supabase.

### D6: Número de migración `0009`
La migración más reciente es `0008_geography_schema.sql`.

## Risks / Trade-offs

- **Bull media y product media comparten bucket**: si se borra un bull, sus archivos en Storage no se borran automáticamente. Riesgo bajo en MVP (pocas entidades); agregar limpieza en una Edge Function en el futuro.
- **Límite de 50 MB en Supabase Storage (plan free)**: suficiente para imágenes. Videos de alta calidad podrían exceder el límite de archivo individual; informar al usuario en la UI.
- **Supply fold en product**: `supply.service.ts` queda como thin wrapper o se elimina. Los componentes `supply-list` y `supply-form` se actualizan para llamar `ProductService` filtrando `product_type = 'SUPPLIES'`.

## Migration Plan

1. Aplicar `0009` contra Supabase (credenciales usuario)
2. Crear bucket `product-media` via Supabase Dashboard o Management API
3. Reescribir servicios Angular + actualizar modelos
4. Actualizar `bull-list`, `bull-form`; reescribir `supply-list`, `supply-form` como wrappers de productos
5. Crear `product-list`, `product-form` (nuevos)
6. Crear vista backoffice `/admin/products` para SUPER_ADMIN
7. Actualizar `seller-routes.ts` y `backoffice-routes.ts`
8. `ng build` + verificación manual

**Rollback:** Reapuntar los servicios al `environment.apiUrl` legacy cambiando la implementación de los 3 servicios; la interfaz pública no cambia.

## Open Questions

- ¿Se incluyen PDFs (registro genealógico, pedigrí, evaluación andrológica) en este módulo o se difieren? **Decisión sugerida**: incluirlos como `media_type = 'document'` en `product_media`, upload a Supabase Storage, sin render especial en el MVP (solo link de descarga).
- ¿El SKU (`code`) es generado por el sistema o lo ingresa el SELLER libremente? **Decisión sugerida**: SELLER lo ingresa libremente; unique constraint por `(tenant_id, code)` para evitar duplicados dentro del mismo vendedor.
