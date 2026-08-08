## Why

El catálogo público lista una tarjeta por pajilla. Un toro con tres tipos de pajilla ocupa tres tarjetas casi idénticas —misma foto, mismo nombre, misma raza— que solo se distinguen por una etiqueta y el precio. Con pocos toros ya se nota; en cuanto el catálogo crezca, una página de doce resultados podrá contener cuatro toros repetidos.

Lo que el comprador elige es el toro; el tipo de pajilla es una variante de esa compra. La portada ya lo resuelve así desde el cambio del toro destacado: una tarjeta por toro, con sus pajillas como variantes seleccionables. El catálogo debe comportarse igual, y con la misma tarjeta.

## What Changes

- **El catálogo se separa en dos pestañas**: "Genética" agrupa las pajillas por toro, e "Insumos" mantiene la lista de productos sueltos que ya existe. Sustituyen al selector de tipo actual (Todos / Pajillas / Insumos), porque un toro y un insumo son unidades distintas y mezclarlos en una sola lista rompe la paginación del servidor.
- **La tarjeta de la portada se reutiliza sin cambios visuales** en la pestaña de genética.
- **El modelo se renombra**: `FeaturedStraw` → `BullListing` y `FeaturedStrawCardComponent` → `BullListingCardComponent`. Dejan de ser exclusivos de los destacados en cuanto el catálogo los usa, y el nombre viejo pasaría a mentir.
- **Una sola vista para las dos superficies**: `featured_straws` se reemplaza por `bull_listings`, que expone además `breed_id`, `min_price`, `max_price`, `is_featured` y la fecha del producto más reciente. La portada la consulta filtrando por destacado; el catálogo la pagina y la filtra.
- **Los filtros siguen funcionando sobre toros**: por raza, y por precio con el criterio de que el toro entra si **alguna** de sus pajillas cae en el rango. La tarjeta arranca mostrando la variante más barata.
- **La paginación pasa a contar toros**, no pajillas, y el contador de resultados de la cabecera dice "toros" en la pestaña de genética.

**BREAKING** para `ProductService`: `getFeaturedStraws()` desaparece en favor de `getFeaturedBulls()` y `getCatalogBulls(page, limit, filters)`. `getPublicCatalog()` se conserva porque la pestaña de insumos lo sigue usando.

## Capabilities

### New Capabilities

Ninguna. El cambio reorganiza dos capacidades existentes.

### Modified Capabilities

- `public-product-catalog`: el catálogo deja de listar una tarjeta por pajilla y pasa a agrupar la genética por toro, con pestañas, paginación por toro y el criterio de precio por rango de variantes.
- `featured-bull`: la tarjeta y el modelo que definía cambian de nombre al dejar de ser exclusivos de la portada, y la vista que los alimenta se generaliza.

## Impact

- **Base de datos**: nueva vista `bull_listings` (superconjunto de `featured_straws`, que se elimina). Sin cambios en tablas, políticas ni datos.
- **Código renombrado**: `core/models/featured.model.ts` → `bull-listing.model.ts`; `shared/components/featured-straw-card/` → `bull-listing-card/`.
- **Código modificado**: `product.service.ts` (una consulta nueva, una renombrada), `home.component.ts` (nombres), `catalog.component.ts` y `catalog.component.html` (pestañas, agrupación, paginación).
- **Sin cambios**: `ProductCardComponent`, que sigue sirviendo a la pestaña de insumos; el detalle de producto en `/catalog/:id`, al que la tarjeta enlaza con la variante seleccionada; y el carrito.
