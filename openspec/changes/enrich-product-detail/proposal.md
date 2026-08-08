## Why

La ficha de producto enseña menos de lo que el vendedor ya subió. `getProduct()` trae la media del producto **y la de su toro** —`entityIds = [id, bull_id]`—, pero la plantilla filtra `mediaType === 'image'` y descarta el resto: el vídeo del toro y el PDF de la prueba genética están cargados y no se ven. El toro que hoy está en el catálogo ya tiene su PDF subido y nadie puede abrirlo.

Además, la ficha es la única superficie que no deja elegir el tipo de pajilla: llegas a la variante concreta y, si querías la sexada, no hay forma de cambiar sin volver al catálogo. Y muestra `$30000.00 USD / unidad` donde la tarjeta del catálogo, un clic antes, muestra `$30.000` en pesos.

## What Changes

- **Vídeo del toro**: si existe media `video` del toro, la ficha lo reproduce con el reproductor nativo, junto a la galería.
- **Prueba genética**: si existe media `document` del toro, se muestra incrustada con la primera página visible y un botón para abrirla a pantalla completa o descargarla. El botón es el respaldo real, porque los navegadores móviles a menudo no incrustan PDF.
- **Selector de tipo de pajilla**: la ficha carga las pajillas hermanas del mismo toro y ofrece las aprobadas como variantes. Elegir una navega a `/catalog/:idDeEsaPajilla`, de modo que cada variante conserva su enlace propio y el precio y el stock siempre corresponden a lo que se ve.
- **Precio en pesos, formateado**: `$30.000` en vez de `$30000.00 USD / unidad`. Se extrae un `PricePipe` compartido con el formato que ya usa la tarjeta del catálogo (`Intl.NumberFormat('es-CO', COP)`), y se aplica a **todo el flujo de compra**: ficha, tarjeta del catálogo, carrito y checkout.
- **Agregar al carrito**: ya funciona con selector de cantidad y mínimo de pedido; se conserva tal cual y pasa a respetar la variante seleccionada.

**Nota de alcance**: pediste formatear el precio en la ficha. Lo aplico también a carrito, checkout y tarjeta de insumos porque son el mismo recorrido de compra: arreglar solo la ficha dejaría al comprador viendo `$30.000` y, un clic después, `$30000.00` por el mismo producto — una incoherencia que este cambio habría introducido.

## Capabilities

### Modified Capabilities

- `public-product-catalog`: la ficha de producto pasa a mostrar el vídeo y la prueba genética del toro cuando existen, a ofrecer las variantes de pajilla del toro, y a presentar los precios en pesos con formato.

## Impact

- **Código nuevo**: `shared/pipes/price.pipe.ts`.
- **Código modificado**: `product-detail.component.ts` (vídeo, PDF, selector de variantes, precio), `product-card.component.ts`, `bull-listing-card.component.ts` (pasa a usar el pipe en vez de su formateador propio), `cart.component.html`, `checkout.component.html` y `checkout.component.ts`.
- **Servicios**: `getStrawProductsByBull()` ya existe y se reutiliza; se le añade el filtro por `status = 'ACTIVE'` para que un vendedor autenticado no vea sus propias variantes sin aprobar entre las opciones públicas.
- **Sin cambios**: base de datos, políticas, almacenamiento. El bucket `product-media` ya es público y `public_read_active_media` ya expone la media del toro cuando tiene un producto activo.
