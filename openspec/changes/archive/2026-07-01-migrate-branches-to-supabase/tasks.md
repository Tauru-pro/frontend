## 1. Esquema de base de datos y RLS

- [x] 1.1 Crear tabla `branches` (`id`, `tenant_id` FK a `seller_profiles.id`, `name`, `address`, `phone`, `city_id`, `latitude`, `longitude`, `business_hours`, `is_main`, `status`, `created_at`, `updated_at`, `unique(tenant_id, name)`) — aplicada en producción
- [x] 1.2 Reutilizar `public.set_updated_at()` (de `migrate-breeds-to-supabase`) como trigger de `updated_at` — aplicada
- [x] 1.3 Política RLS de dueño: `(auth.jwt() ->> 'tenant_id')::uuid = tenant_id` para `all`, con `with check` — aplicada; probado un insert con `tenant_id` ajeno vía RLS real → rechazado (403, `42501`)
- [x] 1.4 Política RLS de lectura para `ADMIN`/`SUPER_ADMIN` — aplicada
- [x] 1.5 Trigger `enforce_single_main_branch` — aplicada y probada con datos reales vía RLS: primera sucursal de un tenant queda `is_main: true` automáticamente; al marcar una segunda como principal, la primera se desmarca (exactamente una principal en todo momento)
- [x] 1.6 Aplicar la migración contra el proyecto Supabase real — aplicada y verificada: esquema, políticas, triggers, constraint único confirmados vía `pg_policies`/`pg_trigger`/`pg_constraint`; nombre duplicado probado vía RLS real → rechazado (409, `23505`); datos de prueba limpiados (el `on delete cascade` de `tenant_id` borró las sucursales de prueba al borrar el tenant de prueba)

## 2. Modelo de datos

- [x] 2.1 Agregar `latitude?`, `longitude?`, `businessHours?` a `Branch`/`CreateBranchDto`/`UpdateBranchDto`; cambiar `city` a opcional en `core/models/branch.model.ts` (también `sellerId` → `tenantId`, sin uso previo fuera del modelo, para que el tipo refleje el esquema nuevo)

## 3. BranchService

- [x] 3.1 Reescribir `getMyBranches(page, limit, status?)` usando `supabase.from('branches').select('*', { count: 'exact' })`, envuelto en `from(...)` para conservar `Observable<PaginatedResponse<Branch>>` — el filtro por tenant lo aplica RLS automáticamente, no hace falta filtrar en el cliente
- [x] 3.2 Reescribir `getBranch(id)` (Observable, mismo contrato)
- [x] 3.3 Reescribir `createBranch(dto)`, `updateBranch(id, dto)`, `deleteBranch(id)` como métodos `async`/`Promise`, mapeando duplicado de nombre (constraint `unique`) a un error reconocible
- [x] 3.4 Reescribir `setMain(id)` como `update({ is_main: true }).eq('id', id)` — el trigger se encarga de desmarcar las demás
- [x] 3.5 Mapear filas `snake_case` (`tenant_id`, `business_hours`, `is_main`, etc.) a los campos `camelCase` de `Branch`
- [x] 3.6 Resolver el `tenant_id` del caller vía el claim del JWT (nuevo helper compartido `core/auth/jwt-claims.ts#getJwtClaim`, reutilizable por los módulos de productos/inventario que vienen después) para incluirlo en `createBranch`

## 4. Vistas

- [x] 4.1 Actualizar `branch-form.component.ts`: agregar campos de latitud, longitud y horario; cambiar `firstValueFrom(...)` por `await` directo en las mutaciones; actualizar el manejo de error de nombre duplicado al nuevo formato
- [x] 4.2 Actualizar `branch-list.component.ts`: cambiar `firstValueFrom(...)` por `await` directo en `onSetMain`/`onDeleteConfirm` — verificado con `ng build`

## 5. Verificación manual

- [ ] 5.1 Como `SELLER` sin sucursales: crear la primera sucursal y confirmar que queda marcada como principal automáticamente
- [ ] 5.2 Crear una segunda sucursal y marcarla como principal; confirmar que la primera se desmarca
- [ ] 5.3 Confirmar que crear una sucursal con un nombre duplicado (mismo tenant) muestra el error esperado
- [ ] 5.4 Confirmar que un `SELLER` no puede leer/editar sucursales de otro vendedor (llamada directa a Supabase, no solo por la UI)
- [ ] 5.5 Como `ADMIN`/`SUPER_ADMIN`: confirmar lectura de sucursales de todos los tenants (sin UI todavía — verificar vía llamada directa)
- [ ] 5.6 Editar y eliminar una sucursal existente, confirmar que la lista se actualiza correctamente
