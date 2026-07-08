## Context

La página `/admin/products` con el componente `ProductsValidationComponent` ya tiene la funcionalidad completa: tabla paginada de productos `PENDING_VALIDATION`, botones Aprobar / Solicitar cambios / Rechazar, y un modal para ingresar el motivo. La ruta en `backoffice-routes.ts` también existe y está protegida con `superAdminGuard`. El catálogo público filtra por `status === 'ACTIVE'` de forma hardcodeada en `ProductService.getPublicCatalog()`, por lo que aprobar un producto automáticamente lo hace visible sin cambios adicionales.

Lo que falta es (1) exponer el nav item en el sidebar (está comentado), y (2) un mecanismo de notificación para que el admin sepa cuando hay solicitudes pendientes.

## Goals / Non-Goals

**Goals:**
- Activar el nav item "Productos" en el sidebar de admin.
- Mostrar un badge con la cuenta de `PENDING_VALIDATION` en el nav item.
- Corregir el bug de validación de formulario en `submitModal()`.

**Non-Goals:**
- Notificaciones push (browser Notification API, email, Supabase Realtime) — se puede añadir en un change futuro si el badge no es suficiente.
- Badge con polling en tiempo real — el badge refleja el conteo al momento de cargar el backoffice.
- Cambios en la lógica de aprobación/rechazo — ya funciona correctamente.

## Decisions

### 1 — Badge estático al cargar, sin polling

**Decisión**: Obtener el conteo de pendientes una sola vez al inicializar `BackofficeLayoutComponent` usando `toSignal(productService.getPendingCount())`. El badge se actualizará si el usuario navega fuera y vuelve al backoffice (Angular recrea el layout), o al recargar.

**Rationale**: Añadir polling o Supabase Realtime introduce complejidad significativa y subscripciones a gestionar. El caso de uso dominante es que el admin revisa la cola periódicamente, no en tiempo real.

### 2 — `NavItem.badge?: number` en la interfaz compartida

**Decisión**: Extender la interfaz `NavItem` con `badge?: number` en lugar de añadir una abstracción nueva. El sidebar renderiza el badge condicionalmente cuando el valor es > 0.

**Rationale**: Es la extensión mínima — no requiere un componente extra ni un sistema de estado dedicado. Todos los nav items existentes siguen funcionando sin cambios.

### 3 — `getPendingCount()` en `ProductService`

**Decisión**: Añadir un método que reutiliza `getAllPendingValidation(1, 1)` y mapea el resultado a solo el `total`. Sin una tabla separada ni RPC.

**Rationale**: La query ya existe y Supabase devuelve el total exacto con `count: 'exact'`. No hay costo de red adicional relevante.

### 4 — SSR guard con `isPlatformBrowser`

**Decisión**: Envolver la llamada a `getPendingCount()` con `isPlatformBrowser(PLATFORM_ID)` — en SSR se usa `signal(0)` en lugar de `toSignal`.

**Rationale**: La ruta `/admin/products` usa `RenderMode.Server` por el patrón `:id`, pero el layout puede ser prerrenderizado. La llamada a Supabase sin sesión en SSR devolvería 0 y potencialmente lanzaría un error; el guard lo evita limpiamente.

## Risks / Trade-offs

- **Badge desactualizado**: si el admin procesa ítems en la página y luego mira el badge (sin recargar), el badge seguirá mostrando el valor inicial. Esto es aceptable en MVP — el badge es una señal de entrada, no un contador en tiempo real.
- **Rol ADMIN vs SUPER_ADMIN**: el guard de la ruta usa `superAdminGuard` pero `BackofficeLayoutComponent` sirve a ambos roles admin y seller. El seller nunca verá el badge de productos porque su `sellerNavItems` no incluye ese item.
