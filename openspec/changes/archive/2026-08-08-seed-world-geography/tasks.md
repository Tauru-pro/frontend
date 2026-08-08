## 1. Migración de esquema

- [x] 1.1 Crear `supabase/migrations/0016_geography_world_attributes.sql` con `alter table public.countries add column if not exists iso2 text, iso3 text, phonecode text, emoji text, external_id integer`
- [x] 1.2 Añadir en la misma migración `states.state_code text`, `states.external_id integer`, `cities.external_id integer`
- [x] 1.3 Añadir índices únicos **no parciales** sobre `countries(iso2)` y sobre `external_id` en las tres tablas (los NULL son distintos entre sí en Postgres, así que toleran las filas legadas sin conciliar; un índice parcial no sería inferible por el `on conflict (external_id)` que emite PostgREST)
- [x] 1.4 Añadir índices `states(country_id)` y `cities(state_id)`
- [x] 1.5 Verificar que la migración es idempotente (`if not exists` en todo) y que no toca políticas RLS ni triggers `set_updated_at`

## 2. Script de seed mundial

- [x] 2.1 Reescribir la cabecera de `scripts/seed-geography.ts`: nueva `DATA_URL` (`countries+states+cities.json` de `dr5hn/countries-states-cities-database`), interfaces `DatasetCountry` / `DatasetState` / `DatasetCity` con los campos usados (`id`, `name`, `iso2`, `iso3`, `phonecode`, `emoji`, `states`, `cities`)
- [x] 2.2 Implementar `normalizeName(s)`: minúsculas, `normalize('NFD')` + strip de diacríticos, colapso de espacios
- [x] 2.3 Implementar descarga y `JSON.parse` del dataset con log de tamaño y conteos (`países / estados / ciudades` detectados)
- [x] 2.4 Implementar `upsertInBatches(table, rows, onConflict, size=1000)` con log de progreso por lote
- [x] 2.5 Fase de conciliación 1 — países: leer los países existentes sin `external_id`, emparejar por nombre normalizado con el dataset y asignarles `external_id` + `iso2`/`iso3`/`phonecode`/`emoji`
- [x] 2.6 Fase de conciliación 2 — estados: para cada país ya conciliado, emparejar sus estados legados por nombre normalizado y asignarles `external_id` + `state_code`
- [x] 2.7 Fase de conciliación 3 — ciudades: para cada estado ya conciliado, emparejar sus ciudades legadas por nombre normalizado y asignarles `external_id`
- [x] 2.8 Carga nivel 1: upsert de todos los países `onConflict: 'external_id'`, releer `id, external_id` a un `Map<number, string>`
- [x] 2.9 Carga nivel 2: upsert de todos los estados resolviendo `country_id` desde el mapa de países; releer el mapa de estados
- [x] 2.10 Carga nivel 3: upsert de todas las ciudades en lotes resolviendo `state_id` desde el mapa de estados
- [x] 2.11 Reporte final: filas legadas sin contraparte, cuáles están referenciadas por `branches`/`seller_profiles` (se conservan) y borrado de las no referenciadas
- [x] 2.12 Añadir `NODE_OPTIONS=--max-old-space-size=4096` al script `seed:geography` de `package.json`

## 3. Ejecución y verificación de datos

- [x] 3.1 Aplicar la migración 0016 en la base de datos de desarrollo (requirió `migration repair --status applied 0013 0014 0015`: ya estaban aplicadas en el servidor pero sin registrar, y no son idempotentes)
- [x] 3.2 Ejecutar `npm run seed:geography` y revisar el resumen de conciliación (1 país, 31 estados y 1.070 ciudades legadas conciliadas; 1 estado y 33 ciudades sin contraparte, todos sin referencias, eliminados)
- [x] 3.3 Verificar conteos: 250 países, 5.249 estados, 152.113 ciudades; 0 filas sin `iso2` y 0 sin `external_id` en los tres niveles
- [x] 3.4 Verificar que Colombia conserva su `id` original (`6edae225-…`) y que la sucursal (Bucaramanga) y los dos perfiles de vendedor (Floridablanca, Alejandría) siguen resolviendo su ciudad
- [x] 3.5 Reejecutar el seed una segunda vez y confirmar que los conteos y los `id` no cambian (idempotencia): mismos 250/5.249/152.113, 0 conciliaciones, 0 borrados

## 4. Modelo y servicio Angular

- [x] 4.1 Añadir la interfaz `Country { id, name, iso2, iso3?, phonecode, emoji }` a `src/app/core/models/location.model.ts` y añadir `countryId` obligatorio a `State`, `stateId` a `City`
- [x] 4.2 Implementar `LocationService.getCountries()` ordenado por `name`
- [x] 4.3 Cambiar `getStates(countryId)` a filtro `eq('country_id', countryId)` eliminando el join `countries!inner`
- [x] 4.4 Cambiar `getCities(stateId)` a filtro `eq('state_id', stateId)` con `.limit(10000)`, eliminando el join `states!inner` y el mapeo `states[0]`
- [x] 4.5 Añadir `getCityLocation(cityId)` que devuelva `{ cityId, stateId, countryId }` para resolver hacia arriba en modo edición
- [x] 4.6 Añadir `getCountryByIso2(iso2)` para los formularios que fijan un país por dominio (tarifas de envío) sin volver a filtrar por nombre

## 5. Selector de ubicación

- [x] 5.1 Añadir el combo de país a `LocationSelectComponent` con etiqueta `{{ emoji }} {{ name }}`, señales `countries`/`selectedCountryId`/`countriesLoading`
- [x] 5.2 Preseleccionar Colombia (`iso2 === 'CO'`) cuando no llega valor inicial, y cargar sus estados
- [x] 5.3 Implementar `onCountryChange`: limpia estado y ciudad, recarga estados, emite
- [x] 5.4 Cambiar `loadCities` para recibir `stateId` en lugar de `stateName` y eliminar la señal `selectedStateName`
- [x] 5.5 Extender `LocationSelection` con `countryId` y ajustar `emit()` para exigir los tres valores
- [x] 5.6 Implementar la resolución en modo edición: con `initialCityId`, usar `getCityLocation` para precargar país y estado antes de los combos dependientes
- [x] 5.7 Ajustar el layout a tres columnas (`grid-cols-3` en escritorio, apilado en móvil) y las etiquetas en español ("País", "Departamento/Estado", "Ciudad")

## 6. Consumidores del selector

- [x] 6.1 Actualizar `features/seller/branches/branch-form.component.ts` a la nueva `LocationSelection`
- [x] 6.2 Actualizar `features/backoffice/pickup-points/pickup-point-form.component.ts`
- [x] 6.3 Actualizar `features/marketplace/checkout/checkout.component.ts`
- [x] 6.4 Actualizar `features/seller/settings/seller-settings.component.ts`
- [x] 6.5 Actualizar `features/backoffice/shipping-rates/shipping-rate-form.component.ts`
- [x] 6.6 Actualizar `features/marketplace/become-seller/become-seller.component.ts` (consumidor no detectado al planificar)
- [x] 6.7 Actualizar `checkout.component.html` (el selector vive en un `templateUrl`, no en la plantilla inline)
- [x] 6.8 Buscar llamadas restantes a `getStates(` / `getCities(` con argumentos de tipo nombre y corregirlas

## 7. Verificación final

- [x] 7.1 `npm run build` sin errores de tipos
- [ ] 7.2 Probar en dev el flujo de sucursal: elegir país distinto de Colombia → estados y ciudades correctos; guardar y reabrir en edición con los tres combos precargados — **pendiente del usuario**: requiere sesión autenticada de vendedor en el navegador; las consultas subyacentes ya se verificaron con la anon key
- [x] 7.3 Probar que un estado con nombre repetido entre países devuelve solo sus propias ciudades: los tres "Córdoba" (Colombia/Argentina/España) devuelven 30/187/75 municipios disjuntos
- [x] 7.4 Confirmar que un vendedor ya onboardeado antes del seed sigue mostrando su ciudad original en ajustes: `getCityLocation` resuelve Alejandría → Antioquia → Colombia con la anon key
