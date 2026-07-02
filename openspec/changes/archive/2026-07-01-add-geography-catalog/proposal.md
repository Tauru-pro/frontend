## Why

Los formularios de sucursales y otros módulos futuros (perfil de vendedor, puntos de pickup) necesitan que el usuario seleccione departamento y municipio de Colombia. Hoy ese selector (`LocationSelectComponent`) depende de endpoints del backend legado NestJS que aún no han sido migrados; la migración a Supabase requiere una fuente de datos propia para el catálogo geográfico.

## What Changes

- Nueva migración Supabase: tablas `countries`, `states` y `cities` con las relaciones definidas en el diagrama (uuid PKs, FKs, timestamps)
- Script de seeding (`scripts/seed-geography.ts`) que descarga `https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json` e inserta Colombia + 33 departamentos + ~1 120 municipios usando el service_role key
- Políticas RLS: lectura pública para las tres tablas (catálogo de referencia, no datos de usuarios)
- `GeographyService` en Angular (`core/services/geography.service.ts`): `getStates(countryName = 'Colombia')` y `getCities(stateName)` como Observables wrapping supabase-js

## Capabilities

### New Capabilities
- `geography-catalog`: Catálogo público de países, departamentos y ciudades; consultas por nombre de país (default Colombia) y por nombre de departamento

### Modified Capabilities
<!-- ninguna — la LocationSelectComponent ya consume un servicio Geography; solo cambia la implementación interna -->

## Impact

- **Nueva migración**: `supabase/migrations/0008_geography_schema.sql`
- **Nuevo script**: `scripts/seed-geography.ts` (Node/tsx, usa `@supabase/supabase-js` service_role, mismo patrón que `seed-super-admin.ts`)
- **Nuevo servicio**: `src/app/core/services/geography.service.ts`
- **`LocationSelectComponent`**: actualmente llama a un servicio legacy; la conexión concreta a `GeographyService` se hace en este cambio si el componente ya existe, o se deja para la tarea de integración si aún no está migrado
- Sin cambios de rutas ni guards
