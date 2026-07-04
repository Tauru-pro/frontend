import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'catalog/:id', renderMode: RenderMode.Server },
  { path: 'admin/users/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/pickup-points/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/shipping-rates/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/breeds/:id/edit', renderMode: RenderMode.Server },
  { path: 'seller/bulls/:id/edit', renderMode: RenderMode.Server },
  { path: 'seller/products/:id/edit', renderMode: RenderMode.Server },
  { path: 'seller/inventory/:itemId', renderMode: RenderMode.Server },
  { path: 'admin/inventory', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
];
