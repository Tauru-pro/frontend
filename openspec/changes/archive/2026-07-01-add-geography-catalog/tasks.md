## 1. Esquema de base de datos

- [x] 1.1 Crear `supabase/migrations/0008_geography_schema.sql`: tablas `countries` (id uuid PK, name varchar unique, created_at, updated_at), `states` (id uuid PK, name varchar, country_id uuid FK→countries, unique(country_id,name), timestamps), `cities` (id uuid PK, name varchar, state_id uuid FK→states, unique(state_id,name), timestamps); trigger `set_updated_at` en las tres tablas
- [x] 1.2 Agregar políticas RLS en la misma migración: `enable row level security` + `create policy "public read" ... for select using (true)` en las tres tablas (sin políticas de escritura — solo service_role puede insertar/actualizar via bypass)
- [x] 1.3 Agregar FK `branches.city_id → cities.id` en la misma migración (`alter table public.branches add constraint branches_city_id_fkey foreign key (city_id) references public.cities(id)`)
- [x] 1.4 Aplicar la migración `0008` contra el proyecto Supabase real (pedir credenciales al usuario)

## 2. Script de seed

- [x] 2.1 Crear `scripts/seed-geography.ts`: fetch `https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json`, upsert Colombia en `countries`, luego iterar departamentos (upsert en `states`), luego iterar ciudades de cada departamento (upsert en batch en `cities`); variables de entorno: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; idempotente via `onConflict`
- [x] 2.2 Agregar `"seed:geography": "tsx scripts/seed-geography.ts"` en `package.json` scripts
- [x] 2.3 Ejecutar `npm run seed:geography` con las credenciales del proyecto real y verificar que los 33 departamentos y ~1120 ciudades se insertan correctamente

## 3. Modelo y servicio Angular

- [x] 3.1 Actualizar `src/app/core/models/location.model.ts`: agregar campo `countryId?: string` a `State`; cambiar `City.state` de `State` a `{ id: string; name: string }` (solo lo que necesita el componente); los campos se mapean desde las filas Supabase en el servicio
- [x] 3.2 Reescribir `src/app/core/services/location.service.ts` usando supabase-js: `getStates(countryName = 'Colombia'): Observable<State[]>` hace join `states!inner(*, countries!inner(*))` filtrando por `countries.name`; `getCities(stateName: string): Observable<City[]>` hace join `cities!inner(*, states!inner(*))` filtrando por `states.name`; ambos ordenados alfabéticamente; eliminar dependencia de `HttpClient`

## 4. Actualizar LocationSelectComponent

- [x] 4.1 Actualizar `LocationSelectComponent` para almacenar el nombre del estado seleccionado en una señal `selectedStateName`; al llamar `onStateChange`, buscar el nombre del estado en la lista cargada y guardarlo; llamar `locationService.getCities(selectedStateName())` en lugar de `getCities(stateId)`
- [x] 4.2 Verificar que `initialStateId` / `initialCityId` siguen funcionando en modo edición (el componente ya tiene esa lógica; solo asegurarse de que al resolver el estado inicial se capture también su nombre para poder cargar las ciudades)

## 5. Verificación

- [x] 5.1 `ng build` sin errores de tipos
- [ ] 5.2 Abrir `/seller/branches/new` como SELLER: confirmar que el selector de departamento carga los 33 departamentos de Colombia desde Supabase
- [ ] 5.3 Seleccionar "Antioquia" y confirmar que el selector de municipios carga los municipios correctos
- [ ] 5.4 Abrir una sucursal existente en modo edición: confirmar que el departamento y municipio precargados se muestran correctamente
