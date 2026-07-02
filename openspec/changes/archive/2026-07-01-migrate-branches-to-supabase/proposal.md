## Why

`openspec/specs/projects.md` (Módulo 3: Infraestructura Descentralizada — Sucursales, RF-007) pide que cada tienda pueda registrar N sucursales físicas con nombre, dirección, coordenadas GPS, ciudad, horario y estado. La gestión de sucursales (`/seller/branches`) ya existe en el frontend con CRUD completo, pero contra el backend REST legacy deprecado — y, más importante, es el primer consumidor natural del claim `tenant_id` que se construyó en `migrate-seller-identity-to-supabase` (Módulo 2): RF-005 nombra explícitamente "Sucursales" como uno de los recursos que deben aislarse por `tenantId`. Migrar este dominio cierra ese círculo y deja sentado el patrón para los módulos de catálogo/inventario que vienen después.

## What Changes

- Crear la tabla `branches` en Supabase con `tenant_id` (FK a `seller_profiles.id`) y RLS: el dueño del tenant tiene acceso total a sus propias sucursales (`(auth.jwt() ->> 'tenant_id')::uuid = tenant_id`); `ADMIN`/`SUPER_ADMIN` pueden leer todas (mismo patrón que `seller_profiles`); no hay lectura pública todavía (ver Non-Goals).
- Agregar a `Branch` los campos de RF-007 que faltan: `latitude`, `longitude` (numéricos, capturados como inputs simples — no se construye un selector de mapa), `businessHours` (texto libre, mismo patrón que `seller_profiles.business_hours`).
- Reescribir `BranchService` contra `supabase-js`, manteniendo el contrato actual (`getMyBranches` sigue devolviendo `Observable<PaginatedResponse<Branch>>` por compatibilidad con el componente existente; las mutaciones — crear/editar/eliminar/marcar como principal — pasan a `Promise`, mismo patrón que `BreedService`/`SellerService`).
- `setMain(id)`: en vez de un endpoint dedicado del backend legacy, se implementa con un trigger en Postgres que al marcar `is_main = true` en una sucursal, desmarca automáticamente las demás del mismo tenant — la operación sigue siendo una sola llamada atómica desde el cliente.
- La primera sucursal que un vendedor registra se marca automáticamente como principal (invariante nueva: nunca hay cero sucursales principales si existe al menos una sucursal), vía el mismo trigger.
- **BREAKING**: cualquier sucursal que solo exista hoy en el backend legacy no se migra automáticamente a Supabase (ver design.md, Open Questions).

## Capabilities

### New Capabilities
- `branch-management`: registro y gestión de sucursales físicas por `SELLER`, aisladas por `tenant_id` verificado vía JWT, con designación de sucursal principal.

### Modified Capabilities
(ninguna — reutiliza el claim `tenant_id` y el patrón de roles ya expuestos por `supabase-authentication`/`super-admin-user-management`/`seller-tenant-identity` sin cambiar sus requisitos)

## Impact

- **Código afectado**: `core/services/branch.service.ts` (reescrito), `core/models/branch.model.ts` (nuevos campos, `city` pasa a opcional — Supabase no tiene tabla de ciudades, mismo límite ya documentado para `seller_profiles`), `features/seller/branches/{branch-list,branch-form}.component.ts` (nuevos campos de formulario, llamadas a Promesas en vez de `firstValueFrom` para las mutaciones).
- **Infraestructura Supabase**: tabla `branches` con RLS por `tenant_id`, trigger para sucursal principal única y auto-asignación de la primera.
- **Fuera de alcance**: selector de mapa/geocodificación (coordenadas se ingresan manualmente), lectura pública de sucursales (necesaria para Módulo 7 — selección de sucursal por cercanía en checkout — pero ese módulo no existe todavía), migración de datos reales del backend legacy.
