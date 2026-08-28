import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'catalog/:id', renderMode: RenderMode.Server },
  { path: 'catalog/bull/:id', renderMode: RenderMode.Server },
  { path: 'orders/:id', renderMode: RenderMode.Server },
  { path: 'admin/products/bull/:bullId', renderMode: RenderMode.Server },
  { path: 'admin/products/:id', renderMode: RenderMode.Server },
  { path: 'admin/users/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/pickup-points/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/shipping-rates/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/breeds/:id/edit', renderMode: RenderMode.Server },
  { path: 'seller/products/bull/:bullId/edit', renderMode: RenderMode.Server },
  { path: 'seller/products/:id/edit', renderMode: RenderMode.Server },
  { path: 'seller/inventory/:itemId', renderMode: RenderMode.Server },
  { path: 'seller/orders/:id', renderMode: RenderMode.Server },
  { path: 'admin/inventory', renderMode: RenderMode.Server },
  { path: 'admin/seller-segments/:id/edit', renderMode: RenderMode.Server },
  { path: 'admin/seller-segments/:id/sellers', renderMode: RenderMode.Server },
  { path: 'admin/commission-rules/:segmentId/new', renderMode: RenderMode.Server },
  { path: 'admin/settlements/:id', renderMode: RenderMode.Server },
  { path: 'seller/settlements/:id', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
];
