## Context

El catálogo geográfico vive en tres tablas Supabase creadas en `0008_geography_schema.sql`: `countries(id, name unique)`, `states(id, name, country_id, unique(country_id,name))` y `cities(id, name, state_id, unique(state_id,name))`, con RLS de lectura pública y escritura reservada a `service_role`. Los datos actuales provienen de `scripts/seed-geography.ts`, que carga Colombia, 33 departamentos y ~1.120 municipios desde `marcovega/colombia-json` y hace upsert por nombre.

Dos tablas apuntan al catálogo: `branches.city_id → cities.id` (FK desde 0008) y `seller_profiles.city_id → cities.id` (FK desde 0012). Ambas son `on delete` por defecto (`NO ACTION`), así que cualquier borrado de ciudades referenciadas fallará — lo cual es deseable como red de seguridad.

En el frontend, `LocationService` consulta por nombre (`getStates(countryName='Colombia')`, `getCities(stateName)`) y `LocationSelectComponent` renderiza dos combos (departamento/municipio) con Colombia implícita. Lo consumen cinco formularios: sucursales de vendedor, puntos de recogida, checkout, ajustes de vendedor y tarifas de envío.

La fuente elegida es `dr5hn/countries-states-cities-database`, archivo `json/countries+states+cities.json`: un único array JSON de ~46,5 MB con países anidando `states[]` y estos `cities[]`. Cada país trae `id`, `name`, `iso2`, `iso3`, `phonecode`, `emoji` (más divisa, timezones y traducciones que no usaremos); cada estado trae `id`, `name`, `iso2` (código de subdivisión); cada ciudad trae `id`, `name`, `latitude`, `longitude`.

## Goals / Non-Goals

**Goals:**

- Poblar el catálogo con los ~250 países, ~5.000 estados y ~150.000 ciudades del dataset, de forma idempotente y reanudable.
- Añadir a `countries` los atributos `iso2`, `iso3`, `phonecode` y `emoji` pedidos para formularios de dirección y teléfono.
- Conservar la integridad referencial: ninguna sucursal ni perfil de vendedor debe quedar con un `city_id` colgado o apuntando a otra ciudad.
- Hacer que las consultas del selector sean unívocas (por ID) y sigan siendo rápidas con dos órdenes de magnitud más de filas.

**Non-Goals:**

- No se importan divisa, husos horarios, traducciones, población, región/subregión ni coordenadas de ciudad. Se dejan fuera para no arrastrar ~40 MB de datos sin consumidor; añadirlos después es una migración aditiva.
- No se construye una UI administrativa para editar el catálogo (sigue siendo de solo lectura vía RLS).
- No se automatiza el seed en CI/CD ni se programa una sincronización periódica con upstream; sigue siendo un comando manual de operador.
- No se cambia la forma en que `branches`/`seller_profiles` almacenan ubicación (siguen guardando solo `city_id`).

## Decisions

### 1. Claves de conciliación: `external_id` del dataset, no el nombre

El seed actual hace `onConflict: 'name'` / `'country_id,name'` / `'state_id,name'`. Con el dataset mundial eso es frágil: upstream corrige tildes y renombra ciudades entre releases, y un rename por nombre crea una fila nueva y deja huérfana la vieja (con FKs apuntando a ella).

Se añade `external_id integer unique` a las tres tablas, poblado con el `id` numérico del dataset, y los upserts usan `onConflict: 'external_id'`. Los `id` internos siguen siendo UUID generados por la base — las FKs existentes no cambian de tipo ni de valor.

El índice único es **no parcial**: Postgres considera los NULL distintos entre sí, así que las filas legadas sin `external_id` conviven sin problema, y —a diferencia de un índice parcial— un índice total sí puede ser inferido por el `on conflict (external_id)` sin `where` que emite PostgREST en los upserts.

*Alternativa descartada*: usar el `id` numérico del dataset como PK. Rompería `branches.city_id`/`seller_profiles.city_id` (uuid) y ataría el esquema a un proveedor externo.

### 2. Reconciliación de las filas legadas de Colombia

Las filas actuales no tienen `external_id`, así que un upsert por `external_id` insertaría duplicados de todo Colombia. El seed ejecuta, antes de la carga, una fase de conciliación por nombre normalizado (minúsculas, sin tildes vía `normalize('NFD')` + strip de diacríticos, espacios colapsados):

1. `countries`: la fila `Colombia` adopta el `external_id`, `iso2`, `iso3`, `phonecode` y `emoji` del dataset.
2. `states`: para cada estado legado bajo Colombia, se busca su contraparte por nombre normalizado; si coincide, adopta el `external_id`.
3. `cities`: igual, dentro de cada estado ya conciliado.
4. Las filas legadas sin contraparte se reportan; se borran solo si ninguna FK las referencia (consulta previa a `branches` y `seller_profiles`); si están referenciadas, se conservan y el resumen las lista para decisión manual.

Este orden importa: conciliar de arriba hacia abajo garantiza que al llegar a ciudades el estado padre ya tiene identidad estable.

*Alternativa descartada*: truncar y recargar. Es más simple pero rompe `branches.city_id`/`seller_profiles.city_id` y perdería la ubicación de vendedores ya onboardeados.

### 3. Carga por lotes en dos pasadas, no un único árbol anidado

El archivo cabe en memoria (~46,5 MB de JSON → varios cientos de MB de heap tras `JSON.parse`), así que se descarga completo y se parsea de una vez; el script se ejecuta con `NODE_OPTIONS=--max-old-space-size=4096` para dar margen. Los inserts van en lotes de 1.000 filas por request (`upsert` de supabase-js), nivel por nivel:

1. Upsert de los ~250 países en un lote; se lee de vuelta `id, external_id` a un `Map`.
2. Upsert de los ~5.000 estados en lotes, resolviendo `country_id` desde el mapa; se lee de vuelta el mapa de estados.
3. Upsert de las ~150.000 ciudades en lotes, resolviendo `state_id` desde el mapa.

El script imprime progreso cada lote y es reanudable por construcción: si falla en la ciudad 90.000, volver a ejecutarlo re-upserta lo ya cargado sin efectos secundarios.

*Alternativa descartada*: streaming con un parser incremental (`stream-json`). Ahorra memoria pero añade una dependencia y complica la resolución padre→hijo; el tamaño no lo justifica.

*Alternativa descartada*: `COPY` vía `psql`. Sería mucho más rápido, pero exige credenciales de conexión directa a Postgres que hoy no forman parte del flujo (el resto de scripts usa `SUPABASE_SERVICE_ROLE_KEY` con supabase-js).

### 4. `LocationService` consulta por ID y gana `getCountries()`

`getCities(stateName)` es incorrecto a nivel mundial: "Córdoba" existe en Colombia, Argentina y España, y el filtro `eq('states.name', …)` devolvería la unión de las tres. Se cambia la firma a `getStates(countryId)` / `getCities(stateId)` con `eq('country_id', …)` / `eq('state_id', …)`, lo que además elimina los joins `!inner` y con ello el mapeo defensivo de `states[0]`.

Se añade `getCountries()` devolviendo `{ id, name, iso2, phonecode, emoji }` ordenado por nombre (~250 filas, una sola carga).

### 5. Índices sobre las FKs del catálogo

Postgres no indexa automáticamente las columnas FK. Hoy `states.country_id` y `cities.state_id` se apoyan en el índice implícito de sus `UNIQUE (country_id, name)` / `UNIQUE (state_id, name)`, cuyo prefijo izquierdo sirve para filtrar. Se añaden igualmente índices explícitos `states(country_id)` y `cities(state_id)` — baratos frente a 150.000 filas — para que el plan no dependa de conservar esas restricciones compuestas, y un índice sobre `cities(name)` no se añade porque la búsqueda del combo es cliente-side sobre la lista ya cargada.

**Nota de rendimiento**: cargar todas las ciudades de un estado sigue siendo del orden de cientos de filas; el peor caso del dataset (algunos estados con >5.000 ciudades) supera el límite por defecto de 1.000 filas de PostgREST, así que `getCities` fija `.limit(10000)` explícitamente.

### 6. El selector de país usa el emoji como bandera

`emoji` viene como el carácter de bandera regional (🇦🇫), así que se renderiza directo en la etiqueta de `SearchSelectComponent` (`{{ emoji }} {{ name }}`) sin assets ni sprites. El combo de país se preselecciona en Colombia buscando `iso2 === 'CO'`.

Para edición de registros existentes solo se guarda `city_id`, así que el selector resuelve hacia arriba: dado `initialCityId`, consulta la ciudad con su `state_id` y el `country_id` de ese estado, y precarga ambos combos. Eso añade una consulta de resolución (`cities` → `states`) que hoy no existe.

## Risks / Trade-offs

- **Duplicados por nombres que no casan en la conciliación de Colombia** (el dataset escribe "Bogota D.C." donde el seed legado escribió "Bogotá D.C.", o municipios con grafías distintas) → la normalización quita tildes y colapsa espacios; además el script imprime al final la lista de filas legadas no conciliadas para revisión manual antes de borrar nada. El borrado automático se limita a filas sin referencias.
- **Seed largo y sujeto a errores de red** (~150.000 filas en lotes de 1.000 ≈ 150 requests) → idempotencia por `external_id`: reejecutar tras un fallo continúa sin duplicar. Se registra progreso por lote para saber dónde se quedó.
- **Consumo de memoria del parse** (~46,5 MB de texto) → se documenta `--max-old-space-size=4096` en el script npm; si aun así falla en máquinas pequeñas, la salida de escape es el parser incremental descartado en la decisión 3.
- **BREAKING en `LocationService`** → los cinco formularios consumidores se actualizan en el mismo change; ninguno es API pública, así que el radio de impacto está acotado al repo.
- **La UI de ciudad se degrada en estados enormes** (p. ej. algunos estados de India o Brasil con miles de municipios) → `SearchSelectComponent` filtra en cliente sobre la lista cargada; se acepta para este change y se anota como candidato a búsqueda server-side si aparece un caso real lento.
- **Crecimiento de la base de datos** (~155.000 filas, decenas de MB) → dentro del plan de Supabase actual; se evita multiplicarlo dejando fuera coordenadas y traducciones.

## Migration Plan

1. Aplicar la migración `0016_geography_world_attributes.sql`: columnas nuevas nullable, índices, y `unique` en `iso2` y `external_id`. Es aditiva y no bloquea lecturas.
2. Ejecutar `npm run seed:geography` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de destino. Revisar el resumen de conciliación.
3. Desplegar el frontend con el `LocationService` y el selector nuevos. El orden importa: el frontend nuevo espera países con `iso2`/`emoji`, así que el seed va antes.
4. **Rollback**: revertir el deploy del frontend restaura el comportamiento previo (los datos añadidos no le estorban: filtrar por nombre "Colombia" sigue funcionando). Los datos mundiales pueden retirarse con `delete from cities where external_id is not null and id not in (select city_id …)`, pero la vía sensata ante un problema es dejar los datos y revertir solo la UI.
