## Context

`getPublicCatalog(page, limit, filters)` consulta `products` con `count: 'exact'` y `.range()`, filtrando `status = 'ACTIVE'`: la paginación la resuelve Postgres sobre productos. `CatalogComponent` pinta un `ProductCardComponent` por producto en una rejilla, con filtros de tipo, raza y precio en la barra lateral.

La portada ya agrupa por toro desde el cambio del toro destacado: la vista `featured_straws` devuelve una fila por toro con sus pajillas aprobadas agregadas en un `jsonb`, y `BullListingCardComponent` —hoy `FeaturedStrawCardComponent`— la pinta con selector de variantes y botón de añadir al carrito. Esa vista se salta la RLS de sus tablas base a propósito y su lista de columnas es la única barrera de privacidad; por eso el vendedor se reduce a `business_name`.

El nudo del cambio es la paginación: **no se puede paginar por toro consultando productos**. Doce productos pueden ser cuatro toros o doce; el `count` y el `range` dejan de significar lo que la interfaz muestra. Agrupar en cliente lo que devuelve una página de productos daría páginas de tamaño irregular y un contador falso.

Cada pieza tiene un solo consumidor (`FeaturedStraw`, `FeaturedStrawCardComponent`, `getFeaturedStraws`), así que renombrar es barato.

## Goals / Non-Goals

**Goals:**

- Una tarjeta por toro en el catálogo, con paginación y contador que cuenten toros.
- Reutilizar la tarjeta de la portada sin bifurcarla.
- Conservar los filtros de raza y precio, resueltos en el servidor.
- Que los insumos sigan comprándose desde el catálogo.

**Non-Goals:**

- No se toca `ProductCardComponent`, que sigue sirviendo a los insumos.
- No se cambia el detalle en `/catalog/:id`, que sigue siendo por producto: la tarjeta enlaza con la variante seleccionada.
- No se añade ordenación configurable (por precio, por nombre). El orden sigue siendo por novedad, como hoy.
- No se toca el buscador por texto: no existe hoy y no entra aquí.

## Decisions

### 1. Una vista `bull_listings` sustituye a `featured_straws`

La portada y el catálogo quieren la misma fila; solo cambia el filtro. En vez de dos vistas casi iguales, una con las columnas que ambos necesitan:

```sql
create or replace view bull_listings as
select b.id as bull_id, b.name as bull_name,
       b.is_featured,
       br.id as breed_id, br.name as breed_name,
       sp.id as seller_id, sp.business_name as seller_name,
       (portada del toro) as cover_path,
       min(p.price) as min_price,
       max(p.price) as max_price,
       max(p.created_at) as last_published_at,
       jsonb_agg(...) as straws
  from bulls b
  join products p on p.bull_id = b.id and p.status = 'ACTIVE'
  ...
 group by ...;
```

- **Portada**: `.eq('is_featured', true)`.
- **Catálogo**: `.range()` + `count: 'exact'` + filtros.

`featured_straws` se elimina en la misma migración: tiene un único consumidor y mantener dos vistas divergentes sobre las mismas tablas es la forma segura de que una se quede atrás.

La advertencia de la vista anterior se traslada literal: sigue leyendo por debajo de la RLS, así que **añadir una columna la publica a `anon` de inmediato**.

### 2. `min_price` / `max_price` hacen exacto el filtro de precio

"El toro entra si alguna pajilla cae en el rango" es, en términos de intervalos, que el intervalo del toro y el del filtro se solapen:

```
max_price >= filtroMin  AND  min_price <= filtroMax
```

Con esas dos columnas agregadas en la vista, el filtro se traduce a `.gte('max_price', min)` y `.lte('min_price', max)` y lo resuelve Postgres. Sin ellas habría que desempaquetar el `jsonb` en cada fila o filtrar en cliente, y el `count` volvería a mentir.

*Alternativa descartada*: filtrar sobre el `jsonb` con operadores de contención. Funciona, pero no aprovecha índices y expresa peor una condición de solapamiento.

### 3. `last_published_at` conserva el orden actual

El catálogo ordena hoy por `products.created_at desc`. Agrupado por toro, el equivalente natural es la fecha del producto más reciente del toro: un toro con una pajilla nueva vuelve a lo alto. Se agrega como `max(p.created_at)` y el catálogo ordena por ella.

### 4. Pestañas en vez del selector de tipo

Mezclar toros e insumos en una rejilla paginada obligaría a fusionar dos consultas con `count` propio y a repartir a mano los elementos de cada página. Separarlos elimina el problema de raíz: cada pestaña tiene su consulta, su `count` y su paginación.

El selector "Tipo" de la barra lateral desaparece —su función la absorben las pestañas— y el filtro de raza pasa a mostrarse solo en la de genética, que es lo que ya hacía `showBreedFilter()` cuando el tipo era `STRAW`. Los filtros de precio sirven a las dos.

Al cambiar de pestaña se vuelve a la página 1 y se conservan los filtros de precio; el de raza se limpia al entrar en insumos, donde no aplica.

### 5. Renombrar el modelo y el componente, no duplicarlos

En cuanto el catálogo usa la tarjeta, `FeaturedStraw` describe mal lo que contiene: un toro con sus variantes, destacado o no. Se renombra a `BullListing` (`FeaturedStrawVariant` → `BullListingVariant`), el componente a `BullListingCardComponent`, y el archivo a `core/models/bull-listing.model.ts`. Un solo consumidor de cada uno, así que es un renombrado mecánico.

`is_featured` viaja en el modelo aunque el catálogo no lo use: es la columna que distingue las dos consultas y omitirla obligaría a dos formas de fila.

### 6. Dos métodos de servicio, no uno con bandera

```ts
getFeaturedBulls(): Observable<BullListing[]>
getCatalogBulls(page, limit, filters): Observable<PaginatedResponse<BullListing>>
```

Comparten el mapeo de fila, pero no la forma del resultado: la portada quiere una lista sin paginar y el catálogo una página con totales. Un único método con parámetros opcionales devolvería un tipo unión que ambos llamantes tendrían que estrechar.

## Risks / Trade-offs

- **La vista agrega en cada consulta**: `group by` + `jsonb_agg` sobre `bulls ⨝ products` en cada página del catálogo. Con el volumen actual es irrelevante; si algún día pesa, la salida son índices sobre `products(bull_id, status)` o una tabla materializada. No se resuelve por adelantado.
- **Eliminar `featured_straws` rompe cualquier consumidor externo** que no esté en este repositorio. Solo lo usa `getFeaturedStraws()`, pero la vista es pública para `anon` y no hay forma de saber si alguien más la consulta. Se asume que no, dado que se creó en el cambio inmediatamente anterior.
- **Un toro con muchas variantes hace la tarjeta más alta** que las de insumos, y las dos pestañas ya no se ven idénticas. Es consecuencia de tener dos unidades distintas; separarlas en pestañas hace que nunca compartan rejilla.
- **El filtro de precio deja de coincidir con el precio visible**: la tarjeta muestra la variante más barata, que puede caer fuera del rango pedido si quien entró en rango fue una variante cara. Es el coste de "alguna pajilla en rango"; la alternativa —filtrar por el mínimo— escondería toros que sí interesan.
- **El contador cambia de significado** ("N toros" en vez de "N productos"). Es lo pretendido, pero un comprador acostumbrado verá números más bajos con el mismo catálogo.

## Migration Plan

1. Aplicar la migración: crear `bull_listings`, otorgar `select` a `anon` y `authenticated`, y eliminar `featured_straws`.
2. Desplegar el frontend. **El orden importa y el hueco no es seguro**: entre el paso 1 y el 2 la portada desplegada consulta una vista que ya no existe y su sección de destacados queda vacía. Si el hueco molesta, crear `bull_listings` primero, desplegar, y eliminar `featured_straws` en una segunda migración.
3. **Rollback**: revertir el frontend exige devolver `featured_straws`, porque la portada anterior la consulta. Su definición queda en la migración `0018` para recrearla.

## Open Questions

- ¿Debe la pestaña de genética ofrecer también el filtro por tipo de pajilla (convencional / sexado)? Hoy no existe ese filtro y agrupar por toro lo hace más natural —filtraría toros que ofrezcan ese tipo—, pero no estaba en lo pedido.
