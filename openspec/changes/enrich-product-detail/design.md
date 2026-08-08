## Context

`ProductDetailComponent` ya recibe todo lo que necesita y lo tira:

```ts
// product.service.ts — getProduct()
const entityIds = [id, ...(row.bull_id ? [row.bull_id] : [])];
// trae product_media de AMBAS entidades

// product-detail.component.ts
images = computed(() => (this.product()?.media ?? []).filter((m) => m.mediaType === 'image'));
```

El vídeo y el PDF del toro llegan en `p.media` y ningún sitio los mira. Comprobado contra la base real: el toro `Ms Casaray Yara` tiene una imagen y un `document` en `product_media`, ambos legibles con la anon key gracias a `public_read_active_media`, y el bucket `product-media` es público (`0013`). No hacen falta políticas ni cambios de almacenamiento; sí una vista de lectura, por el motivo de la decisión 1.

`getStrawProductsByBull(bullId)` también existe ya, creada para el modo edición del vendedor. Filtra por `bull_id` y `product_type`, pero no por `status`.

Los precios se pintan con `toFixed(2)` y un literal "USD" en la ficha, el carrito, el checkout y la tarjeta de insumos. La única superficie con el formato correcto es `BullListingCardComponent`, que lleva su propio `Intl.NumberFormat('es-CO', COP)` en un método privado.

## Goals / Non-Goals

**Goals:**

- Sacar a la superficie el vídeo y la prueba genética que el vendedor ya subió.
- Que la ficha permita cambiar de tipo de pajilla sin volver al catálogo.
- Un único formateador de precio para todo el recorrido de compra.

**Non-Goals:**

- No se cambia cómo el vendedor sube la media: eso ya funciona y tiene su propia capacidad (`bull-management`).
- No se añade galería de vídeo ni varios documentos. El esquema del vendedor permite un vídeo y un PDF por toro; la ficha asume lo mismo.
- No se renderiza el PDF con `pdf.js`. Se descartó en la decisión 2.
- No se añade internacionalización de moneda. Se fija el peso colombiano, que es lo que el marketplace vende.

## Decisions

### 1. Una sola petición contra una vista `product_details`

`product_media` es polimórfica: `entity_id` es un uuid pelado que apunta a `bulls` o a `products`, sin clave foránea. PostgREST no puede embeberla —responde `PGRST200` a `products?select=...,product_media(...)`— y por eso `getProduct()` ya hacía dos peticiones antes de este cambio.

El embed anidado sí funciona para el resto: `products?select=*,bulls(*,products(*))` trae producto, toro y hermanas de una vez. Pero sin la media eso deja la ficha en dos peticiones.

La vista `product_details` cierra el hueco agregando la media en `jsonb`, igual que `bull_listings`: **una fila por producto activo**, con el toro, su media, y todas las variantes aprobadas del toro con la suya. Una petición para pintar la ficha entera, y ninguna al cambiar de variante.

Cada variante lleva los campos completos de `Product`. No es exceso: `CartStore.addItem` exige el objeto entero porque lo persiste y lo repinta en `/carrito`, así que una forma reducida obligaría a una petición extra al añadir —justo la que `BullListingCardComponent` sí tiene que hacer—.

Los insumos entran por el mismo camino: `left join` sobre `bulls`, y `variants` contiene el propio producto cuando no hay toro. El componente no necesita dos ramas.

`getStrawProductsByBull(bullId, onlyActive)` deja de usarse en la ficha pero se mantiene: `product-form.component.ts` y `product-review.component.ts` lo necesitan con las no aprobadas.

### 2. El PDF se incrusta con `<object>` y un enlace de reserva dentro

```html
<object [data]="docUrl()" type="application/pdf" class="w-full h-96">
  <!-- contenido de reserva: lo pinta el navegador que no sabe incrustar -->
  <p>Tu navegador no puede mostrar el PDF.</p>
</object>
<a [href]="docUrl()" target="_blank" rel="noopener">Abrir prueba genética</a>
```

`<object>` con contenido interno es el mecanismo estándar: el navegador que puede, incrusta; el que no —la mayoría de los móviles—, pinta lo de dentro. El enlace vive **fuera** del `<object>`, siempre visible, porque es el camino real en móvil y esconderlo detrás de un fallo de incrustación lo haría invisible justo donde más falta hace.

*Alternativa descartada*: `pdf.js` para renderizar la primera página como imagen. Se ve mejor y funciona igual en todas partes, pero son ~300 kB de bundle para una ficha de producto. Si algún día importa la miniatura, lo barato es generarla al subir el PDF, no en el cliente.

*Alternativa descartada*: `<iframe>`. Equivalente en la práctica, pero no admite contenido de reserva.

**Sanitización**: Angular bloquea las URL en `[data]` de `<object>` por seguridad. Hay que pasarlas por `DomSanitizer.bypassSecurityTrustResourceUrl`. Es seguro aquí porque la URL la compone `getMediaPublicUrl()` a partir del `storage_path` de nuestro propio bucket, no de una entrada del usuario.

### 3. Cambiar de variante no navega: se selecciona en memoria

Como la fila de `product_details` ya trae todas las variantes, elegir otra es mover una señal. El estado de la ficha pasa a ser `detail` (la fila) + `selectedId`, y `product` es un `computed` que busca dentro de `variants`: precio, stock, mínimo de pedido y galería se recalculan solos, sin red y sin que la página parpadee.

La URL se mantiene en sintonía con `Location.replaceState('/catalog/<id>')`, que cambia la barra de direcciones **sin** disparar el Router. Así el enlace compartido apunta a la variante que se ve —el motivo por el que en su día se optó por navegar— sin pagar la recarga. Como no notifica al Router, tampoco reentra por `paramMap`: no hay bucle. El botón atrás vuelve al catálogo en vez de recorrer las variantes visitadas, que es lo deseable.

La suscripción a `route.paramMap` se conserva para el caso de llegar a otra ficha desde el catálogo con el componente ya montado, y solo vuelve a pedir datos cuando el `id` entrante no está entre las variantes ya cargadas.

### 4. Un `PricePipe` compartido, no un método por componente

`BullListingCardComponent` ya tiene el formato correcto encerrado en un método privado. Extraerlo a `shared/pipes/price.pipe.ts` lo hace usable desde plantillas sin duplicar nada:

```ts
@Pipe({ name: 'price', standalone: true })
// Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
```

*Alternativa descartada*: el `CurrencyPipe` de Angular. Hace lo mismo, pero exige registrar el locale `es-CO` en el arranque y repetir `| currency:'COP':'symbol':'1.0-0':'es-CO'` en cada plantilla. Un pipe propio es una palabra.

Se aplica a ficha, tarjeta de insumos, tarjeta de toro, carrito y checkout. **Es más superficie de la que se pidió**, y la razón está en la propuesta: arreglar solo la ficha crearía la incoherencia en vez de resolverla.

### 5. El vídeo usa el reproductor nativo

`<video controls preload="metadata">` con la URL pública. Sin autoplay —un vídeo que arranca solo en una ficha de producto es hostil— y con `preload="metadata"` para no descargar el archivo entero a quien no le da a reproducir.

## Risks / Trade-offs

- **`<object>` con PDF se comporta distinto en cada navegador** → por eso el enlace externo es visible siempre y no un respaldo escondido. La incrustación es una mejora, no el mecanismo.
- **Tocar carrito y checkout amplía el radio de prueba** más allá de la ficha. Es un cambio mecánico —sustituir `toFixed(2)` por el pipe— pero pasa por pantallas de dinero, así que hay que mirarlas. A cambio, el recorrido queda coherente.
- **`bypassSecurityTrustResourceUrl` desarma una protección de Angular** → acotado a la URL que compone `getMediaPublicUrl()` desde nuestro bucket. Si algún día la ruta viniera de fuera, esta decisión habría que revisarla.
- **Otra vista pública que se salta la RLS.** Es la tercera (`bull_listings`, `product_details`), y cada una repite la misma advertencia: su `where` es la única barrera y toda columna añadida queda pública. La alternativa —dos peticiones y sin vista— era más barata en superficie pero dejaba la ficha con datos llegando a destiempo y el cambio de variante pidiendo red.
- **La fila repite los datos del toro por cada variante.** Con dos o tres pajillas es irrelevante; se filtra siempre por `product_id`, así que nunca se traen varias filas a la vez.
- **El precio en pesos sin decimales redondea** lo que hubiera con céntimos. Los precios cargados son enteros y el peso colombiano no usa céntimos en la práctica, pero si alguna vez se venden productos con decimales, se perderían en pantalla.

## Open Questions

- ¿Debe el vídeo del toro aparecer también en las tarjetas del catálogo, como indicador de que hay uno? Aquí solo se muestra en la ficha.
