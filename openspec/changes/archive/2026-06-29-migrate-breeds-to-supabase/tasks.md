> El usuario aplicó `0005_breeds_schema.sql` contra el proyecto real. Al probar
> la creación de una raza como `SUPER_ADMIN` desde la app, falló con "new row
> violates row-level security policy" — **bug real encontrado y corregido**:
> `custom_access_token_hook` (de `migrate-auth-to-supabase`, migración 0003)
> no tenía `security definer`. GoTrue invoca el hook como `supabase_auth_admin`,
> que no bypassa RLS; el `select role from profiles` interno quedaba filtrado
> a cero filas por las políticas de `profiles` (ni `auth.uid()` ni `auth.jwt()`
> aplican en ese contexto), así que el hook siempre caía al default `CUSTOMER`
> sin importar el rol real. El test manual vía Management API (como `postgres`,
> que sí bypassa RLS) no lo detectó. Corregido en
> `supabase/migrations/0003_custom_access_token_hook.sql` (agregado
> `security definer set search_path = public`) y aplicado en vivo; verificado
> con un JWT recién emitido (`user_role: SUPER_ADMIN`) y un insert real contra
> `/rest/v1/breeds` que ya tiene éxito.

## 1. Esquema de base de datos y RLS

- [x] 1.1 Crear tabla `breeds` (`id`, `name` único, `purpose` con check `MILK|MEAT`, `created_at`, `updated_at`) en Supabase — `supabase/migrations/0005_breeds_schema.sql`, aplicada por el usuario
- [x] 1.2 Escribir política RLS de lectura pública (`for select using (true)`, sin restricción de rol)
- [x] 1.3 Escribir política RLS de escritura (`insert`/`update`/`delete`) restringida a `(auth.jwt() ->> 'user_role') = 'SUPER_ADMIN'`
- [x] 1.4 Aplicar la migración contra el proyecto Supabase real y verificar que las políticas existen (`pg_policies`) — aplicada; bug de `custom_access_token_hook` encontrado y corregido (ver nota arriba); verificado con insert real

## 2. BreedService

- [x] 2.1 Reescribir `BreedService.getAll()` usando `supabase.from('breeds').select('*')`, envuelto en `from(...)` de RxJS para conservar el contrato `Observable<Breed[]>` que ya consumen `home.component.ts`, `bull-form.component.ts` y `breeds.component.ts`
- [x] 2.2 Reescribir `BreedService.getOne(id)` de forma equivalente (Observable, mismo contrato que hoy)
- [x] 2.3 Reescribir `BreedService.create(dto)`, `update(id, dto)`, `delete(id)` como métodos `async` que devuelven `Promise`, mapeando un nombre duplicado (constraint `unique` de Postgres) a un error reconocible por el caller
- [x] 2.4 Mapear filas `snake_case` de Supabase (`created_at`, `updated_at`) a los campos `camelCase` de `Breed` (`createdAt`, `updatedAt`)

## 3. Vistas de administración de razas

- [x] 3.1 Actualizar `breed-form.component.ts`: cambiar `firstValueFrom(this.service.create/update(...))` por `await this.service.create/update(...)` directo; actualizar el manejo del error de nombre duplicado al nuevo formato de error de `BreedService`
- [x] 3.2 Actualizar `breeds.component.ts`: cambiar `await firstValueFrom(this.service.delete(item.id))` por `await this.service.delete(item.id)` directo

## 4. Guard de acceso

- [x] 4.1 Aplicar `superAdminGuard` (ya existente, de `migrate-auth-to-supabase`) a las rutas `breeds`, `breeds/new` y `breeds/:id/edit` en `backoffice-routes.ts`

## 5. Verificación manual

- [ ] 5.1 Confirmar que la página de inicio del marketplace sigue cargando el listado de razas sin sesión
- [ ] 5.2 Confirmar que el selector de raza en el formulario de creación de toro (seller) sigue funcionando
- [ ] 5.3 Como `SUPER_ADMIN`: crear, editar y eliminar una raza desde `/admin/breeds`
- [ ] 5.4 Confirmar que crear una raza con un nombre duplicado muestra el error esperado
- [ ] 5.5 Confirmar que un `ADMIN` (no `SUPER_ADMIN`) es redirigido al intentar acceder a `/admin/breeds` o `/admin/breeds/new`
