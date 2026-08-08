## Context

`ProductDetailComponent` ya recibe todo lo que necesita y lo tira:

```ts
// product.service.ts — getProduct()
const entityIds = [id, ...(row.bull_id ? [row.bull_id] : [])];
// trae product_media de AMBAS entidades

// product-detail.component.ts
images = computed(() => (this.product()?.media ?? []).filter((m) => m.mediaType === 'image'));
```

El vídeo y el PDF del toro llegan en `p.media` y ningún sitio los mira. Comprobado contra la base real: el toro `Ms Casaray Yara` tiene una imagen y un `document` en `product_media`, ambos legibles con la anon key gracias a `public_read_active_media`, y el bucket `product-media` es público (`0013`). **No hace falta tocar base de datos, políticas ni almacenamiento.**

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

### 1. Las variantes se leen de las pajillas hermanas, no de `bull_listings`

La vista `bull_listings` ya devuelve las pajillas aprobadas de un toro, y sería tentador reutilizarla. Pero devuelve una fila **por toro**, y la ficha parte de un `productId`: habría que consultar la vista y buscar dentro del `jsonb` cuál corresponde, o resolver el `bullId` primero y luego filtrar la vista. `getStrawProductsByBull(bullId)` va directa y ya devuelve `Product[]` completos, que es lo que la ficha maneja.

Se le añade `.eq('status', 'ACTIVE')`. Sin ese filtro, la RLS ya oculta las no aprobadas a los visitantes anónimos, pero **un vendedor autenticado viendo su propia ficha vería sus borradores como variantes comprables**. La política no basta porque `seller_own_products` le da acceso total a lo suyo.

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

### 3. Cambiar de variante navega

Cada pajilla es un producto con su URL, su precio y su stock. Intercambiar en sitio dejaría la barra de direcciones apuntando a la variante original: compartir el enlace tras elegir "Sexado Macho" mandaría al receptor a la convencional. Navegar a `/catalog/:id` mantiene esa correspondencia y no cuesta nada, porque el componente ya se recarga por parámetro de ruta.

Como el componente lee el `id` con `route.snapshot`, navegar a otra ficha del mismo componente **no lo reconstruye**: hay que pasar a suscribirse a `route.paramMap` para que reaccione. Es el detalle que hace funcionar toda la decisión.

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
- **La ficha pasa a hacer dos consultas** (producto + hermanas). Son dos peticiones ligeras y sin dependencia entre sí más allá del `bullId`; no justifican una vista nueva.
- **El precio en pesos sin decimales redondea** lo que hubiera con céntimos. Los precios cargados son enteros y el peso colombiano no usa céntimos en la práctica, pero si alguna vez se venden productos con decimales, se perderían en pantalla.

## Open Questions

- ¿Debe el vídeo del toro aparecer también en las tarjetas del catálogo, como indicador de que hay uno? Aquí solo se muestra en la ficha.
