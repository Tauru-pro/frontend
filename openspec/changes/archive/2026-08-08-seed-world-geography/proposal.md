## Why

El catálogo geográfico solo contiene Colombia (sembrado desde un JSON específico de Colombia), y la tabla `countries` solo guarda `name`. Tauru necesita operar con vendedores y compradores fuera de Colombia, y la UI necesita mostrar identificadores de país (bandera, prefijo telefónico, código ISO) para formularios de dirección y teléfono. Además, el `LocationService` filtra por **nombre** de estado/país, algo que deja de ser unívoco en cuanto existan estados homónimos en varios países (p. ej. "Santiago", "Córdoba", "Santa Cruz").

## What Changes

- **Modelo de datos**: `countries` gana `iso2` (único), `iso3`, `phonecode`, `emoji` y `external_id`; `states` gana `state_code` y `external_id`; `cities` gana `external_id`. `external_id` (el `id` numérico del dataset upstream) se vuelve la clave de conciliación idempotente en los tres niveles.
- **Seed mundial**: el script `seed:geography` se reescribe para consumir `countries+states+cities.json` de `dr5hn/countries-states-cities-database` (~46 MB) y cargar los ~250 países, ~5.000 estados y ~150.000 ciudades del mundo, por lotes y de forma reanudable/idempotente.
- **Conciliación con los datos existentes de Colombia**: las filas ya sembradas (sin `external_id`) se emparejan con las del dataset por nombre normalizado; las referencias `branches.city_id` y `seller_profiles.city_id` se reapuntan a la fila canónica y las filas legadas sin referencias se eliminan. Ninguna fila referenciada por una FK se borra.
- **BREAKING** `LocationService.getStates(countryName?)` / `getCities(stateName)` pasan a `getCountries()` / `getStates(countryId)` / `getCities(stateId)`, con búsqueda por ID en lugar de por nombre.
- **UI**: `LocationSelectComponent` incorpora un tercer combo de país (con bandera emoji), con Colombia preseleccionada por defecto, y emite `countryId` además de `stateId`/`cityId`. Los formularios que lo consumen (sucursales, puntos de recogida, checkout, ajustes de vendedor, tarifas de envío) se ajustan a la nueva salida.
- **Rendimiento de lectura**: índices sobre `states.country_id` y `cities.state_id` para que los combos sigan respondiendo con el catálogo mundial completo.

## Capabilities

### New Capabilities

Ninguna. El cambio amplía una capacidad existente.

### Modified Capabilities

- `geography-catalog`: el catálogo pasa de ser exclusivamente colombiano a mundial; los países exponen atributos ISO/telefónicos/bandera; el seed cambia de fuente y de estrategia de idempotencia (`external_id`); el servicio Angular consulta por ID y expone países; el selector de ubicación incluye país.

## Impact

- **Base de datos**: nueva migración sobre `public.countries` / `states` / `cities` (columnas, índices, unicidad de `iso2` y `external_id`). Sin cambios en las políticas RLS: siguen siendo de lectura pública y escritura solo `service_role`.
- **Datos**: crecimiento de ~1.150 filas a ~155.000 filas en el catálogo. `branches.city_id` y `seller_profiles.city_id` pueden ser reapuntados durante la conciliación.
- **Código**: `scripts/seed-geography.ts` (reescritura), `src/app/core/models/location.model.ts`, `src/app/core/services/location.service.ts`, `src/app/shared/components/location-select/location-select.component.ts` y sus cinco consumidores.
- **Operación**: el seed requiere `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, descarga ~46 MB y tarda varios minutos; se ejecuta manualmente, no en el build.
