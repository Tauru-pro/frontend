## Why

El catálogo de razas bovinas (`/admin/breeds`) ya tiene UI completa (listar, crear, editar, eliminar) pero depende del backend REST legacy (`environment.apiUrl/breeds`), que está deprecado desde la migración de auth/usuarios a Supabase. Además, hoy cualquier `ADMIN` puede gestionar razas a través del `adminGuard` de nivel superior; el negocio quiere que el catálogo de razas — al ser un dato maestro que afecta todo el marketplace — quede bajo control exclusivo del `SUPER_ADMIN`, igual que la gestión de usuarios.

## What Changes

- Crear la tabla `breeds` en Supabase (Postgres) con RLS: lectura pública (cualquier visitante necesita ver razas al filtrar/crear anuncios de toros), escritura (insert/update/delete) restringida a `(auth.jwt() ->> 'user_role') = 'SUPER_ADMIN'`.
- Reescribir `BreedService` (`core/services/breed.service.ts`) para usar `supabase-js` (`supabase.from('breeds')`) en vez de `HttpClient` contra el backend legacy. **BREAKING**: cualquier dato de razas que hoy viva solo en el backend legacy no se migra automáticamente (ver Open Questions en design.md).
- Restringir las rutas `/admin/breeds`, `/admin/breeds/new` y `/admin/breeds/:id/edit` a `SUPER_ADMIN` reutilizando el `superAdminGuard` ya creado en la migración de auth (antes eran accesibles para cualquier `ADMIN`). **BREAKING** para `ADMIN`s que hoy gestionan razas.
- Mantener el contrato de datos actual (`Breed`, `CreateBreedDto`, `UpdateBreedDto`) sin cambios de forma, solo de origen (Supabase en vez de REST), para no tocar `breeds.component.ts`/`breed-form.component.ts` más de lo necesario.
- El resto de dominios que consumen razas indirectamente (si los hay, p. ej. selects de raza en formularios de toros) siguen funcionando porque la forma de `Breed` no cambia.

## Capabilities

### New Capabilities
- `breed-catalog-management`: catálogo de razas bovinas en Supabase con lectura pública y escritura exclusiva de `SUPER_ADMIN`, reemplazando el backend REST legacy para este dominio.

### Modified Capabilities
(ninguna — no se cambian los requisitos de `supabase-authentication` ni `super-admin-user-management`; este cambio reutiliza el guard y el claim de rol que ya exponen)

## Impact

- **Código afectado**: `core/services/breed.service.ts` (reescrito), `core/models/breed.model.ts` (probablemente sin cambios de forma), `features/backoffice/breeds/{breeds,breed-form}.component.ts` (sin cambios funcionales, solo siguen funcionando contra el nuevo service), `features/backoffice/backoffice-routes.ts` (agregar `superAdminGuard` a las rutas de breeds).
- **Infraestructura nueva (Supabase)**: tabla `breeds` con políticas RLS (lectura pública, escritura `SUPER_ADMIN`).
- **Fuera de alcance**: el backend legacy sigue existiendo y sirviendo el resto de dominios (bulls, supplies, branches, pickup points, shipping rates, settings); este cambio solo desconecta `breeds` de él.
