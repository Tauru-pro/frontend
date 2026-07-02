## Why

`openspec/specs/projects.md` (Módulo 2: Gestión Multi-Tenant e Identidad Comercial) define RF-005 (aislamiento estricto por `tenant_id`) y RF-006 (registro de tienda/ganadería por el `SELLER`). Hoy esto está a medio migrar: `migrate-auth-to-supabase` creó la tabla `seller_profiles` en Supabase y la embebe en `UserStore.loadUser()`, pero nada escribe en ella — `SellerService` (perfil propio del vendedor) y `UserService.getSellers()` (listado admin) siguen contra el backend legacy deprecado. Resultado: **bug en producción hoy** — cualquier `SELLER` que entra a `/seller/settings` ve su formulario de negocio vacío, porque `UserStore` lee de Supabase (vacío) mientras el formulario en realidad escribe contra el backend legacy (que sí tiene datos, pero que la app ya no lee). Además, el ejemplo de política RLS en `agents.md` propone leer `tenant_id` desde `auth.jwt() -> 'user_metadata'`, que el propio usuario puede modificar vía `updateUser()` — inseguro para aislar tenants.

## What Changes

- Extender `seller_profiles` en Supabase con los campos de RF-006 que faltan: `description`, `country` (texto libre, default `'Colombia'` — no se modela un catálogo de países), `business_hours` (texto libre).
- Extender `custom_access_token_hook` (de `migrate-auth-to-supabase`) para inyectar también el claim `tenant_id` en el JWT — igual a `seller_profiles.id` del vendedor (1 `SELLER` = 1 tienda/tenant), `null` para roles sin tienda. Este es el claim verificado que deben usar las políticas RLS de `seller_profiles` y de cualquier tabla futura con aislamiento por tenant (sucursales, productos, inventario — Módulos 3/5/6, fuera de alcance aquí, pero el patrón queda establecido). **No** se usa `user_metadata` (es modificable por el cliente).
- Reescribir `SellerService.getMyProfile()`/`updateMyProfile()` contra `supabase-js`: `updateMyProfile()` pasa a ser un **upsert** (crea la fila si el `SELLER` aún no tiene tienda registrada — autoservicio, sin aprovisionamiento previo). **BREAKING**: deja de llamar al backend legacy para estos dos métodos.
- Mantener `getPresignedUrl()` contra el backend legacy (necesita credenciales AWS S3 que solo tiene ese backend — fuera de alcance migrar almacenamiento de archivos), pero `confirm(s3Key)` deja de llamar al endpoint legacy de confirmación y en su lugar persiste `logo_key` directamente en `seller_profiles` vía Supabase, cerrando el segundo split-brain (el de logo).
- Reescribir `UserService.getSellers()` para leer de `seller_profiles` (join con `profiles` para nombre/fecha) en Supabase en vez del backend legacy, para que el listado admin (`/admin/sellers`) no quede desincronizado con los datos que ahora viven en Supabase.
- Políticas RLS en `seller_profiles`: el dueño (`auth.uid() = user_id`) puede leer/escribir su propia fila; `SUPER_ADMIN`/`ADMIN` (vía `user_role` claim) pueden leer todas (para el listado admin); ningún otro rol puede leer filas de otros vendedores.

## Capabilities

### New Capabilities
- `seller-tenant-identity`: registro y edición de la identidad comercial del `SELLER` (tienda/ganadería) en Supabase, con aislamiento por `tenant_id` verificado vía JWT, reemplazando el backend REST legacy para este dominio.

### Modified Capabilities
(ninguna — no se cambian los requisitos de `supabase-authentication` ni `super-admin-user-management`; este cambio extiende el mecanismo de claims que ya exponen, no su contrato)

## Impact

- **Código afectado**: `core/services/seller.service.ts` (reescrito), `core/services/user.service.ts` (`getSellers()` reescrito), `core/models/user.model.ts` (`SellerProfile`/`UpdateSellerProfileDto` con los nuevos campos), `features/seller/settings/seller-settings.component.ts` (nuevos campos del formulario, flujo de upsert), `features/backoffice/sellers/sellers.component.ts` (ajuste de tipado/acceso a campos, ya inconsistente hoy entre `UserProfile`/`SellerProfile`).
- **Infraestructura Supabase**: migración SQL que extiende `seller_profiles` (nuevas columnas), agrega RLS, y reemplaza `custom_access_token_hook` para incluir `tenant_id`.
- **Fuera de alcance**: almacenamiento de archivos (sigue en S3/CloudFront vía backend legacy), catálogo de países/ubicaciones (sigue como está), sucursales/productos/inventario (Módulos 3/5/6 — quedan para cambios futuros, este cambio solo deja listo el claim `tenant_id` que necesitarán), flujo de aprobación de tiendas por `SUPER_ADMIN` (no existe hoy, no se construye aquí).
