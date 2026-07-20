import { Routes } from '@angular/router';

export default <Routes>[
  { path: 'products', loadComponent: () => import('./products/product-list.component') },
  { path: 'products/new', loadComponent: () => import('./products/product-form.component') },
  { path: 'products/bull/:bullId/edit', loadComponent: () => import('./products/product-form.component') },
  { path: 'products/:id/edit', loadComponent: () => import('./products/product-form.component') },
  { path: 'branches', loadComponent: () => import('./branches/branch-list.component') },
  { path: 'branches/new', loadComponent: () => import('./branches/branch-form.component') },
  { path: 'branches/:id/edit', loadComponent: () => import('./branches/branch-form.component') },
  { path: 'inventory', loadComponent: () => import('./inventory/inventory-list.component') },
  { path: 'inventory/:itemId', loadComponent: () => import('./inventory/inventory-detail.component') },
  { path: 'settings', loadComponent: () => import('./settings/seller-settings.component') },
  { path: '', redirectTo: 'products', pathMatch: 'full' },
];
