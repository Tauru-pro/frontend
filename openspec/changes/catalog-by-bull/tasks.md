## 1. Vista `bull_listings`

- [x] 1.1 Crear `supabase/migrations/0019_bull_listings_view.sql` con la vista `bull_listings`: partir de la definición de `featured_straws` en la `0018` y añadir `is_featured`, `breed_id`, `min_price`, `max_price` y `last_published_at`
- [x] 1.2 Trasladar literal el comentario de advertencia de la `0018`: la vista lee por debajo de la RLS y su lista de columnas es la única barrera de privacidad
- [x] 1.3 `grant select on public.bull_listings to anon, authenticated`
- [x] 1.4 `drop view if exists public.featured_straws` al final de la migración
- [x] 1.5 Aplicar la migración y comprobar con la anon key que `bull_listings` responde con `min_price`, `max_price` y `is_featured`, y que no expone campos privados del vendedor

## 2. Renombrado de modelo y componente

- [x] 2.1 Renombrar `core/models/featured.model.ts` a `bull-listing.model.ts`, con `BullListing` y `BullListingVariant`, añadiendo `isFeatured: boolean`
- [x] 2.2 Renombrar `shared/components/featured-straw-card/` a `bull-listing-card/` y la clase a `BullListingCardComponent`
- [x] 2.3 Actualizar los imports y usos en `home.component.ts` (`featuredStraws` → `featuredBulls`)
- [x] 2.4 Comprobar que no queda ninguna referencia a `FeaturedStraw`, `featured_straws` ni `FeaturedStrawCard` en `src/`

## 3. Servicio

- [x] 3.1 Extraer el mapeo de fila de la vista a una función compartida (`mapBullListingRow`), incluyendo `isFeatured` y la resolución de `cover_path` con `getMediaPublicUrl`
- [x] 3.2 Reemplazar `getFeaturedStraws()` por `getFeaturedBulls()`: consulta `bull_listings` con `.eq('is_featured', true)`
- [x] 3.3 Añadir `getCatalogBulls(page, limit, filters)` devolviendo `PaginatedResponse<BullListing>`: `count: 'exact'`, `.range()`, orden por `last_published_at` descendente
- [x] 3.4 Traducir los filtros: raza a `.eq('breed_id', ...)`; precio a `.gte('max_price', min)` y `.lte('min_price', max)` — el solapamiento de intervalos que implementa "alguna pajilla en rango"
- [x] 3.5 Dejar `getPublicCatalog()` intacto: lo sigue usando la pestaña de insumos

## 4. Catálogo: pestañas y rejilla de toros

- [x] 4.1 Añadir a `CatalogComponent` la señal de sección (`'GENETICS' | 'SUPPLIES'`) y las señales de toros, sustituyendo `selectedType`
- [x] 4.2 Maquetar las pestañas en `catalog.component.html`, en la cabecera del área de contenido, con la paleta actual
- [x] 4.3 Dividir `load()` en dos caminos según la sección, cada uno con su paginación y su contador
- [x] 4.4 Al cambiar de pestaña: volver a la página 1, conservar el filtro de precio y limpiar el de raza al entrar en insumos
- [x] 4.5 Sustituir la rejilla de la sección de genética por `app-bull-listing-card`, manteniendo la de insumos con `app-product-card`
- [x] 4.6 Quitar el selector de "Tipo" de la barra lateral y del bloque de filtros móviles, y mostrar el de raza solo en genética
- [x] 4.7 Ajustar el contador de la cabecera: "N toros encontrados" en genética, "N productos encontrados" en insumos
- [x] 4.8 Ajustar el estado vacío y el esqueleto de carga a la sección activa

## 5. Verificación

- [x] 5.1 `npm run build` sin errores de tipos
- [x] 5.2 Comprobar con la anon key que un toro con dos pajillas aparece como **una** fila en `bull_listings`, con sus dos variantes dentro: `Ms Casaray Yara` con `min_price` 30.000 y `max_price` 35.000
- [x] 5.3 Comprobar el filtro de precio en el servidor: 32.000–40.000 devuelve el toro (solo alcanza la variante cara); 10.000–20.000 y 40.000–50.000 no devuelven nada
- [x] 5.4 Comprobar que `count: 'exact'` sobre la vista cuenta toros y no pajillas: 1 sobre la vista frente a 2 pajillas activas
- [ ] 5.5 Probar en dev: el catálogo muestra un toro por tarjeta, cambiar de variante actualiza el precio, y agregar al carrito funciona igual que desde la portada — **pendiente del usuario** (requiere navegador)
- [ ] 5.6 Probar la pestaña de insumos: sigue listando productos sueltos con su paginación — **no verificable hoy**: no hay ningún insumo `ACTIVE` en la base, así que la pestaña muestra su estado vacío. La consulta (`getPublicCatalog` con `productType: 'SUPPLIES'`) es la preexistente, sin cambios
- [x] 5.7 Comprobar que la portada sigue pintando los destacados tras el renombrado: `bull_listings?is_featured=eq.true` devuelve el toro destacado
