## Why

La sección "Semen Destacado" de la portada es hoy un maniquí: `home.component.ts` define un array `featuredProducts` escrito a mano, con una interfaz `Product` local que inventa campos (`emoji`, `rating`, `reviews`, `originalPrice`) que no existen en el dominio real. Ningún vendedor puede influir en lo que ahí aparece.

Al mismo tiempo, los vendedores no tienen forma de dar visibilidad a su mejor genética. La regla de negocio que falta es simple: un vendedor puede marcar **un** toro de su catálogo como destacado, siempre que ese toro ya tenga producto aprobado por el administrador, y ese toro aparece en la portada.

## What Changes

- **Toro destacado por vendedor**: `bulls` gana `is_featured`, con un índice único parcial que impide a un mismo vendedor tener dos destacados a la vez. Un toro solo puede destacarse si al menos una de sus pajillas está en estado `ACTIVE` (es decir, aprobada por el administrador); un disparador lo verifica en la base de datos, no solo en la interfaz.
- **Interruptor en el listado del vendedor**: la fila de cada toro en `product-list.component.ts` gana una acción de destacar/quitar. Aparece deshabilitada, con su motivo, mientras el toro no tenga pajillas aprobadas. Marcar uno nuevo desmarca el anterior en una sola operación atómica vía RPC.
- **Sección real en la portada**: "Semen Destacado" pasa a leer datos reales — un toro por vendedor con destacado — y se elimina el array simulado y la interfaz `Product` local del componente de la portada.
- **Nueva tarjeta** `FeaturedStrawCardComponent`, siguiendo la referencia visual aportada: imagen, "Por «vendedor»", nombre del toro con su raza, precio de la variante elegida, selector de variantes (los tipos de pajilla del toro en lugar de los tamaños de la referencia) y botón "Agregar" que añade al carrito respetando `minOrderQuantity`. Se mantienen los colores actuales (`primary`, `secondary`, `accent`).
- **Nueva superficie pública de lectura**: una vista `featured_straws` que expone solo lo que la tarjeta necesita. Es necesaria porque hoy **ni `bulls` ni `seller_profiles` son legibles sin sesión**, y ambos hacen falta para pintar la tarjeta.
- **Corrección colateral**: como `bulls` no tiene política de lectura pública, el catálogo público lleva tiempo mostrando "—" en lugar de la raza (`product.bull` llega `null` para visitantes anónimos). Se añade la política que faltaba.

**BREAKING** para el componente de portada: desaparecen `featuredProducts` y la interfaz `Product` local. `bestSellers`, `popularProducts` y `dealProduct` siguen siendo simulados y quedan fuera de este cambio.

## Capabilities

### New Capabilities

- `featured-bull`: la regla de "un toro destacado por vendedor", su condición de aprobación previa, y la sección de portada que lo publica.

### Modified Capabilities

- `public-product-catalog`: los datos del toro (nombre, raza) pasan a ser legibles sin sesión, que es lo que el catálogo ya dice ofrecer pero hoy no cumple para visitantes anónimos.

## Impact

- **Base de datos**: `bulls.is_featured` + índice único parcial por vendedor, disparador de validación de aprobación, política de lectura pública sobre `bulls`, vista `featured_straws` y RPC `set_featured_bull`.
- **Código nuevo**: `shared/components/featured-straw-card/` (o `marketplace/home/`), y los métodos de servicio que consultan la vista y llaman a la RPC.
- **Código modificado**: `bull.model.ts`, `bull.service.ts`, `product-list.component.ts` (columna de acciones), `home.component.ts` y `home.component.html`.
- **Privacidad**: la vista expone únicamente el nombre comercial del vendedor. No se abre `seller_profiles` entera, que contiene teléfono y dirección.
- **Sin cambios** en el carrito, en el proceso de validación del administrador ni en el modelo de productos.
