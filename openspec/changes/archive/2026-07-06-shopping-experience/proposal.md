## Why

El catálogo público muestra toros en lugar de productos activos, el carrito está atado al modelo legacy (bull + straw), y el flujo completo comprador — buscar → agregar al carrito → pagar — no funciona de extremo a extremo con el nuevo sistema de productos/inventario.

## What Changes

- `CatalogComponent`: migrar de `BullService.getCatalogBulls()` a `ProductService.getPublicCatalog()` (filtra por `status = ACTIVE`); agregar filtros por tipo de producto, raza y rango de precio; rediseñar tarjeta de producto para mostrar imagen de portada, precio, tipo de pajilla y disponibilidad de stock.
- `ProductService`: agregar método `getPublicCatalog()` — consulta anónima/pública a Supabase filtrando `status = ACTIVE`, con soporte de paginación, tipo de producto y raza.
- `ProductDetailComponent` (nueva): página `/catalog/:id` que muestra los detalles completos de un producto (imágenes, precio, descripción, toro vinculado para pajillas, tipo de pajilla, mínimo de pedido, disponibilidad) y permite agregarlo al carrito.
- **BREAKING** `CartStore` / `CartItem`: reemplazar el modelo `{bull, selectedStraw, quantity}` por `{product: Product, quantity: number}`; eliminar dependencia del backend `CartService` — el carrito pasa a ser un store puramente local con persistencia en `localStorage`.
- `CartComponent`: adaptar plantilla al nuevo modelo de items (producto en lugar de toro+pajilla).
- `CheckoutComponent`: adaptar a la nueva forma de `CartItem`; mantener flujo de dos pasos (contacto + punto de recogida) y la lógica de `OrderService.checkoutFromCart()`.

## Capabilities

### New Capabilities

- `public-product-catalog`: Catálogo público de productos ACTIVE con filtros (tipo, raza, precio), paginación y página de detalle por producto.
- `shopping-cart`: Carrito local basado en señales con persistencia en `localStorage`, items por producto, gestión de cantidades y flujo de checkout hasta creación de orden.

### Modified Capabilities

- `product-catalog`: Agregar requisito de método de consulta pública (`getPublicCatalog`) en el servicio — la spec ya exige visibilidad pública de productos ACTIVE, pero el servicio actual no expone una consulta sin filtro de tenant.

## Impact

- **Componentes**: `catalog/catalog.component.ts`, `catalog/bull-card.component.ts` (renombrar/reemplazar), `cart/cart.component.ts`, `checkout/checkout.component.ts` — todos modificados.
- **Componente nuevo**: `marketplace/catalog/product-detail.component.ts` + `marketplace/catalog/product-card.component.ts`.
- **Servicios**: `core/services/product.service.ts` (nuevo método `getPublicCatalog`).
- **Store**: `core/store/cart.store.ts` — rediseño completo del estado y los métodos; `CartService` (HTTP) queda obsoleto para el flujo del carrito.
- **Modelos**: `core/models/cart.model.ts` — nuevas interfaces `CartItem`, `CartState` alineadas con `Product`.
- **Rutas SSR**: `app.routes.server.ts` — sin cambios (la ruta `catalog/:id` ya existe con `RenderMode.Server`).
- **Sin migraciones de BD**: el esquema de `products`, `product_media`, `orders` ya existe; no se agrega ninguna tabla nueva.
