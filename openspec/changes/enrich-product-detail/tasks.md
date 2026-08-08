## 1. Pipe de precio compartido

- [x] 1.1 Crear `src/app/shared/pipes/price.pipe.ts`: pipe standalone `price` con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`
- [x] 1.2 No aplica: `shared/pipes/` no tiene barril (el pipe existente, `s3fileUrl-pipe.ts`, se importa por ruta directa). Se sigue esa convención
- [x] 1.3 Sustituir el método privado `formatPrice` de `BullListingCardComponent` por el pipe

## 2. Servicio: variantes aprobadas

- [x] 2.1 Añadir el filtro por estado a `getStrawProductsByBull()` como **parámetro opcional** `onlyActive`, no fijo
- [x] 2.2 Sí dependía: `product-form.component.ts` (edición del vendedor) y `product-review.component.ts` (revisión del administrador) necesitan las no aprobadas. Un filtro fijo habría roto ambas, de ahí el parámetro opcional

## 3. Ficha: reaccionar al parámetro de ruta

- [x] 3.1 Cambiar `route.snapshot.paramMap.get('id')` por una suscripción a `route.paramMap`, para que navegar entre variantes del mismo componente recargue los datos
- [x] 3.2 Reiniciar el estado local al cambiar de producto: `quantity`, `activeImageUrl`, `addedToCart` y el error
- [x] 3.3 Comprobar que la suscripción se limpia (`takeUntilDestroyed` o `DestroyRef`)

## 4. Ficha: vídeo y prueba genética

- [x] 4.1 Añadir `bullVideo` y `bullDocument` como `computed` sobre `product().media`, filtrando por `mediaType` y `entityType === 'bull'`
- [x] 4.2 Renderizar la sección de vídeo con `<video controls preload="metadata">` solo si existe; sin autoplay
- [x] 4.3 Inyectar `DomSanitizer` y exponer la URL del PDF con `bypassSecurityTrustResourceUrl`, memorizada para no recrearla en cada ciclo de detección
- [x] 4.4 Renderizar el PDF con `<object type="application/pdf">` y contenido de reserva dentro, más un enlace externo **siempre visible** con `target="_blank" rel="noopener"`
- [x] 4.5 No renderizar ninguna de las dos secciones cuando la media no existe (sin marcadores de posición vacíos)

## 5. Ficha: selector de variantes y precio

- [x] 5.1 Cargar las pajillas hermanas con `getStrawProductsByBull(p.bull.id)` cuando el producto es `STRAW` y tiene toro
- [x] 5.2 Renderizar las variantes con `STRAW_LABELS`, marcando la actual con borde y texto `primary` sobre `primary/10`, como en la tarjeta
- [x] 5.3 Al elegir otra, `router.navigate(['/catalog', variante.id])`
- [x] 5.4 Si solo hay una variante aprobada, conservar la etiqueta estática actual en vez del selector
- [x] 5.5 Sustituir `\${{ p.price.toFixed(2) }}` y el literal "USD / unidad" por el pipe de precio y "por unidad"

## 6. Resto del recorrido de compra

- [x] 6.1 Aplicar el pipe en `product-card.component.ts` (tarjeta de insumos del catálogo)
- [x] 6.2 Aplicar el pipe en `cart.component.html` (precio unitario, subtotal, total y total general)
- [x] 6.3 Aplicar el pipe en `checkout.component.html` (costo de envío, total, total general) y revisar `itemTotal()` en `checkout.component.ts`
- [x] 6.4 No queda ningún `toFixed(2)` con `$` en el recorrido de compra. Los que restan están en las secciones **simuladas** de la portada (`dealProduct`, `bestSellers`, `popularProducts`), con datos ficticios en dólares y fuera del alcance de este cambio

## 7. Verificación

- [x] 7.1 `npm run build` sin errores de tipos
- [x] 7.2 Comprobado con la anon key: el toro devuelve `image` y `document`; el PDF se descarga público (HTTP 200, `application/pdf`, 274 kB). Ese toro no tiene vídeo, así que esa sección no se puede ver con los datos actuales
- [x] 7.3 Comprobado: el toro devuelve sus dos pajillas `ACTIVE` (Convencional 30.000 y Sexado Macho 35.000)
- [ ] 7.4 Probar en dev la ficha del toro que ya tiene PDF: se incrusta, el enlace externo abre el archivo y no hay sección de vídeo — **pendiente del usuario** (requiere navegador)
- [ ] 7.5 Probar el selector: cambiar de tipo navega, y el precio, el stock y el mínimo de pedido cambian con él — **pendiente del usuario** (requiere navegador)
- [ ] 7.6 Probar el recorrido completo de precios: tarjeta → ficha → carrito → checkout muestran el mismo importe con el mismo formato — **pendiente del usuario** (requiere navegador)
- [ ] 7.7 Probar en móvil (o con el emulador del navegador) que el PDF no incrustado deja el enlace visible y usable — **pendiente del usuario** (requiere navegador)
