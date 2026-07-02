## Context

`LocationSelectComponent` necesita listas de departamentos y municipios. Hoy las obtiene de `LocationService` que apunta al backend NestJS legacy (`/api/v1/locations/states` y `/api/v1/locations/states/:id/cities`). Al migrar a Supabase no existe esa API, por lo que necesitamos una fuente de datos propia.

El JSON de referencia (`colombia.min.json`) tiene la forma:
```json
[
  { "departamento": "Amazonas", "ciudades": ["Leticia", "Puerto Nariño"] },
  { "departamento": "Antioquia", "ciudades": ["Abejorral", ...] },
  ...
]
```
33 entradas (departamentos), ~1 120 municipios en total.

## Goals / Non-Goals

**Goals:**
- Tablas `countries`, `states`, `cities` en Supabase con PKs uuid y FKs que reflejan el diagrama
- RLS pública de solo lectura; service_role hace el seed
- Script de seed idempotente (`scripts/seed-geography.ts`) con `npm run seed:geography`
- Reescribir `LocationService` sobre supabase-js conservando el contrato Observable
- `getCities` pasa a recibir `stateName: string` en lugar de `stateId: uuid` (coincide con la petición del usuario y simplifica el join)
- Actualizar `LocationSelectComponent` para pasar el nombre del estado en lugar del UUID al llamar a `getCities`

**Non-Goals:**
- Soporte multi-país en la UI (solo Colombia por defecto; el servicio acepta `countryName` como param opcional para futura extensión)
- Buscador/filtrado de ciudades por nombre (la búsqueda en la UI es client-side via `SearchSelectComponent`)
- Paginación (33 departamentos y ~1 120 ciudades caben cómodamente en memoria)
- Internacionalización de nombres

## Decisions

### D1: Migrar `LocationService` en lugar de crear `GeographyService` separado
**Decisión:** Reescribir `location.service.ts` con supabase-js; mantener nombre y rutas de importación.
**Alternativa considerada:** Nuevo `geography.service.ts` + deprecar el existente.
**Razón:** `LocationSelectComponent` y potenciales callers ya importan `LocationService`. Renombrar requeriría actualizar todas las referencias sin aportar valor funcional.

### D2: `getCities(stateName)` en lugar de `getCities(stateId)`
**Decisión:** El método recibe el nombre del departamento (`string`) y hace JOIN implícito via Supabase nested query (`cities!inner(*, states!inner(*))`) filtrando por `states.name`.
**Alternativa considerada:** Mantener `getCities(stateId: uuid)`.
**Razón:** El usuario pidió explícitamente "por nombre de departamento". Además simplifica `LocationSelectComponent`: no necesita rastrear un `selectedStateName` extra — puede pasar el `label` del estado seleccionado directamente.

### D3: Seed script con upsert idempotente
**Decisión:** El script hace `upsert` en los tres niveles usando `onConflict: 'name'` (countries, states dentro de su `country_id`, cities dentro de su `state_id`). El constraint único es `unique(name)` en countries y `unique(country_id, name)` en states, `unique(state_id, name)` en cities.
**Razón:** Permite re-ejecutar sin errores si el script falla a mitad o si se agrega una ciudad nueva al JSON fuente.

### D4: RLS — SELECT público sin necesidad de `anon` key especial
**Decisión:** `create policy "public read" on countries/states/cities for select using (true)` — no requiere autenticación.
**Razón:** Datos de catálogo de referencia. Ocultar ubicaciones geográficas no aporta seguridad.

### D5: Número de migración `0008`
La migración más reciente es `0007_branches_schema.sql`.

## Risks / Trade-offs

- **Carga inicial grande**: `getCities` devuelve todos los municipios de un departamento (~200 en Antioquia). Es aceptable para un select con búsqueda client-side; si escala a nivel nacional se añade paginación después.
- **JOIN por nombre (no UUID)**: Si dos estados tuvieran el mismo nombre en distintos países habría ambigüedad. Mitigado porque el filtro también incluye `countryName` al resolver `state_id` en la query.
- **Seed de ~1 120 filas**: Las inserciones se hacen en lote por departamento (33 batches) para no superar los límites de PostgREST.

## Migration Plan

1. Aplicar `0008_geography_schema.sql` contra el proyecto Supabase (pedir credenciales al usuario, mismo patrón ya establecido)
2. Ejecutar `npm run seed:geography` con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (mismo patrón que `seed:super-admin`)
3. Reescribir `location.service.ts` + actualizar `LocationSelectComponent` + actualizar `location.model.ts`
4. Verificar: abrir el formulario de nueva sucursal → el selector de departamento/municipio carga desde Supabase

**Rollback:** Si algo falla, el servicio puede reapuntar al backend legacy cambiando la implementación; la interfaz pública del servicio no cambia (sigue siendo `getStates()` / `getCities(...)`).

## Open Questions

- ¿Se añade `city_id` a la columna de la tabla `branches` con FK a `cities.id`? La migración `0007` ya tiene `city_id uuid` sin FK (sin la tabla). Este cambio podría agregar la FK como migración `0009` o como parte de esta. **Decisión sugerida:** agregar la FK en esta migración (0008 ya tiene la tabla disponible).
