## 1. Esquema de base de datos y RLS

- [x] 1.1 Agregar columnas `description`, `country` (default `'Colombia'`), `business_hours` a `seller_profiles` — aplicada en producción
- [x] 1.2 Agregar constraint `unique(user_id)` en `seller_profiles` (requisito del upsert) — aplicada, verificada (`pg_constraint`)
- [x] 1.3 Reemplazar la política de propietario por una con `with check` explícito (`for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`) — aplicada, verificada (`pg_policies`)
- [x] 1.4 Agregar política de lectura para `ADMIN`/`SUPER_ADMIN` (`(auth.jwt() ->> 'user_role') in ('ADMIN', 'SUPER_ADMIN')`) — aplicada
- [x] 1.5 Extender `custom_access_token_hook` para inyectar el claim `tenant_id` (= `seller_profiles.id` del usuario, `null` si no tiene tienda) — aplicada
- [x] 1.6 Aplicar la migración contra el proyecto Supabase real y verificar con un JWT recién emitido que `tenant_id` aparece correctamente para un `SELLER` — verificado: `tenant_id: null` sin tienda, `tenant_id: <seller_profiles.id>` con tienda. También se probó el upsert real vía PostgREST (`on_conflict=user_id`): primera llamada inserta, segunda actualiza la misma fila (sin duplicar)

## 2. Modelo de datos

- [x] 2.1 Agregar `description?`, `country?`, `businessHours?` a `SellerProfile` y `UpdateSellerProfileDto` en `core/models/user.model.ts` (también `email?`/`createdAt?` en `SellerProfile`, para el listado admin)

## 3. SellerService

- [x] 3.1 Reescribir `getMyProfile()` usando `supabase.from('seller_profiles').select('*').eq('user_id', ...).maybeSingle()` (puede no existir aún)
- [x] 3.2 Reescribir `updateMyProfile(dto)` como upsert (`onConflict: 'user_id'`)
- [x] 3.3 Reescribir `confirm(s3Key)` para hacer `update({ logo_key: s3Key })` directo en Supabase en vez de llamar al endpoint legacy `/logo/confirm` (implementado como upsert, no plain update, para que funcione aunque aún no exista la fila)
- [x] 3.4 Dejar `getPresignedUrl()` sin cambios (sigue contra el backend legacy)
- [x] 3.5 Mapear filas `snake_case` (`business_name`, `contact_phone`, `logo_key`, `business_hours`) a los campos `camelCase` de `SellerProfile`

## 4. UserService (listado admin)

- [x] 4.1 Reescribir `getSellers(page, limit)` usando `supabase.from('seller_profiles').select('*, profiles!inner(email, created_at)', { count: 'exact' }).range(...)`, devolviendo el mismo `PaginatedResponse<SellerProfile>`

## 5. Vistas

- [x] 5.1 Actualizar `seller-settings.component.ts`: agregar campos de descripción, país y horario al formulario; ajustar `onSubmit`/`loadProfile` al nuevo `SellerService` (Promesas en vez de `firstValueFrom`) — también se cambió `loadProfile()` para leer directo de `SellerService.getMyProfile()` en vez del cache de `UserStore` (más confiable, y necesario porque el cache no se actualiza tras subir el logo)
- [x] 5.2 Actualizar `sellers.component.ts`: corregir el tipo/acceso a campos (`s.sellerProfile?.status` no existe en `SellerProfile`, usar `s.status` consistentemente) y ajustar a la nueva fuente de datos — verificado con `ng build`

## 6. Verificación manual

- [ ] 6.1 Como `SELLER` sin tienda registrada: completar el formulario de configuración por primera vez y confirmar que se crea el registro
- [ ] 6.2 Como ese mismo `SELLER`: editar los datos y confirmar que actualiza en vez de duplicar
- [ ] 6.3 Subir un logo y confirmar que persiste tras recargar la página
- [ ] 6.4 Confirmar que un `SELLER` no puede leer la tienda de otro vendedor (vía llamada directa a Supabase, no solo por la UI)
- [ ] 6.5 Como `ADMIN` y como `SUPER_ADMIN`: confirmar que `/admin/sellers` lista correctamente los vendedores y sus datos actualizados
