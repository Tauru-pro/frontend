## Why

El módulo de aprobación de productos (`/admin/products`) ya está implementado en backend y frontend, pero la página está oculta en el sidebar. Adicionalmente, el admin no recibe ninguna señal visual cuando un vendedor envía una solicitud, por lo que las revisiones quedan bloqueadas sin que el admin lo sepa.

## What Changes

- Exponer la página de validación en el sidebar de admin (nav item comentado → activo).
- Añadir soporte de `badge?: number` en `NavItem` y en `SidebarComponent` para mostrar una píldora con la cuenta de ítems pendientes.
- Añadir método `getPendingCount()` en `ProductService` que devuelve el total de productos `PENDING_VALIDATION`.
- Conectar el badge del sidebar con el conteo reactivo de pendientes en `BackofficeLayoutComponent`.
- Fix menor: `submitModal()` en `products.component.ts` no activa las validaciones del formulario de signals cuando el campo está vacío — corregir usando `submit()`.

## Capabilities

### New Capabilities

_(ninguna — toda la lógica de aprobación ya existe)_

### Modified Capabilities

- `product-validation`: añadir requisito de notificación al admin — el sistema SHALL mostrar la cuenta de productos `PENDING_VALIDATION` como un badge en el sidebar cuando el admin está autenticado.

## Impact

- `src/app/shared/interfaces/nav-item.interface.ts` — campo `badge?` añadido.
- `src/app/shared/components/sidebar/sidebar.component.ts` — template actualizado para renderizar el badge.
- `src/app/core/services/product.service.ts` — nuevo método `getPendingCount()`.
- `src/app/shared/layouts/backoffice-layout.component.ts` — nav item descomentado + badge reactivo.
- `src/app/features/backoffice/products/products.component.ts` — fix de `submitModal()`.
- Sin cambios de API, sin cambios en base de datos, sin nuevas rutas.
