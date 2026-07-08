## 1. ProductService — catálogo público

- [x] 1.1 Añadir método `getPublicCatalog(page, limit, productType?, breedId?, minPrice?, maxPrice?)` a `ProductService` que consulte Supabase con `status = 'ACTIVE'` sin filtro de tenant, incluyendo join a `bulls(breed_id, breeds(name))` para el filtro de raza y haciendo el fetch de media en dos pasos
- [x] 1.2 Añadir interfaz `CatalogFilters` al modelo de producto (`productType`, `breedId`, `minPrice`, `maxPrice`) y `PublicCatalogParams` como argumento del nuevo método

## 2. Catálogo público — componentes de listado

- [x] 2.1 Crear `product-card.component.ts` en `features/marketplace/catalog/` — tarjeta standalone OnPush que muestra imagen de portada (via `getMediaPublicUrl`), nombre, tipo, precio y badge de stock; recibe `[product]` como input signal y emite `(viewDetail)` output
- [x] 2.2 Reescribir `catalog.component.ts` para usar `ProductService.getPublicCatalog()` en lugar de `BullService.getCatalogBulls()`; añadir señales de filtro (`selectedType`, `selectedBreed`, `minPrice`, `maxPrice`); mostrar selector de raza solo cuando `selectedType() === 'STRAW'`
- [x] 2.3 Reescribir `catalog.component.html` para usar `product-card` en lugar de `bull-card`; incluir controles de filtro (select de tipo, select de raza condicional, inputs de precio) y paginación; conservar estilos Tailwind existentes

## 3. Detalle de producto

- [x] 3.1 Crear `product-detail.component.ts` en `features/marketplace/catalog/` — lee `:id` del snapshot de ActivatedRoute, llama a `ProductService.getProduct(id)` verificando que `status === 'ACTIVE'`, expone señales `product`, `loading`, `error`, `quantity` (con mínimo = `minOrderQuantity`); método `addToCart()` delega al CartStore
- [x] 3.2 Añadir template inline en `product-detail.component.ts` con: galería de imágenes (cover primero), datos del producto, campo de cantidad con +/- respetando `minOrderQuantity`, botón "Agregar al carrito" (deshabilitado si stock=0 o cargando), enlace "Volver al catálogo"
- [x] 3.3 Actualizar `marketplace-routes.ts`: cambiar la ruta `catalog/:id` para apuntar a `product-detail.component`; añadir ruta `catalog/bull/:id` apuntando a `bull-detail.component` para mantener acceso al detalle de toro

## 4. CartStore — rediseño con localStorage

- [x] 4.1 Redefinir `CartItem = { product: Product, quantity: number }` en `core/store/cart.store.ts` y eliminar las interfaces `BullSelected` y `SelectedStraw`; eliminar la importación de `CartService` del store
- [x] 4.2 Implementar persistencia en `localStorage`: en `withHooks({ onInit })` leer `tauru_cart` y poplar el estado; después de cada mutación (`addItem`, `updateQuantity`, `removeItem`, `clear`) sincronizar `localStorage.setItem('tauru_cart', JSON.stringify(store.items()))`
- [x] 4.3 Reescribir métodos del store: `addItem(product, qty)`, `updateQuantity(productId, qty)`, `removeItem(productId)`, `clear()`; `count` y `total` como computed signals; eliminar `loadCart()` (ya no llama al backend)

## 5. CartComponent — adaptar al nuevo modelo

- [x] 5.1 Actualizar `cart.component.ts` para usar las nuevas firmas del CartStore (`removeItem(productId)`, `updateQuantity(productId, qty)`); actualizar `increment`, `decrement`, `remove` acorde; eliminar importación de `S3fileUrlPipe` si la imagen se resuelve directamente con URL pública
- [x] 5.2 Reescribir `cart.component.html` para iterar sobre `cartStore.items()` mostrando `item.product.name`, precio, cantidad, subtotal y botón de eliminación; mostrar total del carrito; botón "Ir al checkout" enlaza a `/checkout`

## 6. CheckoutComponent — adaptar al nuevo modelo de carrito

- [x] 6.1 Actualizar `checkout.component.ts`: reemplazar referencias a `item.bull` / `item.selectedStraw` por `item.product`; adaptar `itemTotal` y `strawLabel` (ahora `productTypeLabel`) al nuevo modelo de CartItem; actualizar `confirm()` para incluir `items: cartStore.items().map(i => ({productId: i.product.id, quantity: i.quantity}))` en el DTO de checkout
- [x] 6.2 Reescribir la sección de resumen en `checkout.component.html` con los campos del nuevo `CartItem` (nombre del producto, precio por unidad, cantidad, subtotal)

## 7. Rutas SSR y limpieza

- [x] 7.1 Añadir `{ path: 'catalog/bull/:id', renderMode: RenderMode.Server }` a `app.routes.server.ts` para la ruta del detalle de toro relocada
- [x] 7.2 Eliminar `bull-card.component.ts` si ya no es referenciado por ningún componente; verificar que `bull-detail.component` tenga default export y funcione en la nueva ruta `catalog/bull/:id`
- [x] 7.3 Ejecutar `ng build` y corregir errores de compilación; verificar que el build SSR termine sin errores
