## Context

El marketplace tiene tres flujos distintos en `features/marketplace/`: catálogo, carrito y checkout. El catálogo consulta `BullService.getCatalogBulls()` y muestra toros; el carrito usa un store (`CartStore`) con el modelo `{bull: BullSelected, selectedStraw: SelectedStraw, quantity}` respaldado por un `CartService` HTTP que llama al backend de Node; el checkout ya implementa el flujo de dos pasos y llama a `OrderService.checkoutFromCart()`. Después de migrar el catálogo de productos a Supabase (módulo 6), los productos ACTIVE ya existen en la tabla `products`—el catálogo solo necesita leerlos.

## Goals / Non-Goals

**Goals:**
- Exponer `getPublicCatalog()` en `ProductService` como consulta anónima a Supabase (sin filtro de tenant).
- Migrar `CatalogComponent` para consumir productos en lugar de toros.
- Crear `ProductDetailComponent` en `/catalog/:id`.
- Reemplazar el modelo del carrito por `{product: Product, quantity: number}` con persistencia en `localStorage`.
- Adaptar `CartComponent` y `CheckoutComponent` al nuevo modelo.

**Non-Goals:**
- Geolocalización automática del navegador para ordenar puntos de recogida por distancia (complejidad alta, baja prioridad en MVP).
- Sistema de recomendaciones ni filtros avanzados de búsqueda full-text.
- Pasarela de pago real (sigue siendo un `paymentUrl` simulado del backend).
- Órdenes de seguimiento post-compra.

## Decisions

### 1 — Catálogo público sin filtro de tenant
**Decisión**: `getPublicCatalog()` consulta `products` filtrando solo `status = 'ACTIVE'`, sin `tenant_id`. RLS de Supabase permite lectura anónima de productos ACTIVE (la RLS policy `SELECT` tiene `WITH CHECK` vacío para status=ACTIVE); si no existe esa policy, se añade en la migración del módulo de producto. No se necesita el service_role key en el frontend.

**Alternativa descartada**: llamar al backend de Node para el catálogo público — añade latencia y una capa innecesaria para datos de solo lectura.

### 2 — Carrito local con localStorage
**Decisión**: eliminar la dependencia del `CartService` HTTP para el estado del carrito. `CartStore` pasa a ser un signalStore puramente local que persiste en `localStorage` (clave `tauru_cart`). `CartService` queda obsoleto para este flujo pero no se elimina (puede reactivarse para el merge de sesión anónima en el futuro).

**Rationale**: el backend del carrito está acoplado al modelo bull+straw y requeriría refactorización tanto en frontend como en Node. El carrito local es suficiente para MVP y elimina una dependencia de red en cada carga de página. El modelo `CartItem = {product: Product, quantity: number}` es trivial de serializar.

**Alternativa descartada**: migrar `cart` a una tabla Supabase — introduce un nuevo esquema de BD y complejidad de RLS sin valor adicional para MVP (el carrito es efímero por sesión).

### 3 — ProductDetailComponent separado de BullDetailComponent
**Decisión**: crear `marketplace/catalog/product-detail.component.ts` como componente independiente. La ruta `/catalog/:id` se redirige a este nuevo componente; `bull-detail` permanece en `/catalog/bull/:id` para el acceso directo a la ficha del toro.

**Rationale**: los productos tienen campos distintos (tipo de pajilla, mínimo de pedido, straw_type) y el detalle de toro tiene secciones propias (estadísticas genéticas, historial de evaluaciones). Mezclarlos en un solo componente generaría demasiada lógica condicional.

### 4 — Filtros del catálogo como señales locales (sin query params)
**Decisión**: los filtros (tipo, raza, precio mínimo/máximo) se manejan como señales en el componente y el catálogo se recarga al confirmar. No se persisten en la URL.

**Alternativa descartada**: query params en la URL — añade complejidad de binding con `ActivatedRoute` sin beneficio claro en MVP (el catálogo no se comparte por URL de filtro).

### 5 — Checkout: CartItem adaptado sin cambiar OrderService
**Decisión**: `OrderService.checkoutFromCart()` ya recibe un DTO plano (`buyerFullName`, `pickupPointId`, etc.) y el backend construye la orden leyendo los ítems del carrito desde su propia sesión. Con el carrito local, necesitamos pasar los ítems explícitamente. Se añade `items: {productId, quantity}[]` al `CheckoutFromCartDto` para que el backend los consuma directamente, eliminando el estado de sesión del carrito en el servidor.

**Riesgo**: el backend de Node necesita aceptar `items` en el body — esto puede requerir coordinación con el equipo de backend. Si el endpoint no se actualiza, como fallback se mantiene la llamada sin `items` y el backend lee de su sesión (compatibilidad temporal).

## Risks / Trade-offs

- **localStorage como única persistencia**: si el usuario limpia el storage o cambia de dispositivo pierde el carrito. Aceptable para MVP.
- **RLS policy de lectura pública**: si la policy no existe en Supabase, `getPublicCatalog()` retorna vacío sin error (RLS deniega silenciosamente). Verificar con `anon` key antes de desplegar.
- **Acoplamiento checkout → backend**: `OrderService` sigue llamando a un backend Node que puede tener el modelo viejo de carrito. La coordinación con backend es necesaria para que `checkoutFromCart` acepte `items[]`.
- **BullDetailComponent no se migra**: la ruta `/catalog/:id` cambia a `ProductDetailComponent`; si hay links hardcodeados a `/catalog/<bull-id>`, estos mostrarán un producto no encontrado. Ajustar `BullDetailComponent` a `/catalog/bull/:id` y actualizar referencias.

## Migration Plan

1. Agregar `getPublicCatalog()` a `ProductService` (sin cambio de esquema).
2. Crear `product-card.component.ts` y `product-detail.component.ts`.
3. Reemplazar `CatalogComponent` para usar productos.
4. Rediseñar `CartStore` con modelo local y localStorage.
5. Actualizar `CartComponent` y `CheckoutComponent`.
6. Ajustar rutas en `marketplace-routes.ts` (`/catalog/:id` → `ProductDetailComponent`, añadir `/catalog/bull/:id` → `BullDetailComponent`).
7. Actualizar `app.routes.server.ts` si se añaden rutas con `:id`.

**Rollback**: los cambios son puramente de frontend. Revertir el commit deja el carrito vacío (localStorage se limpia) pero no rompe datos en BD.
