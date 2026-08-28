import { Routes } from '@angular/router';

export default <Routes>[
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component') },
  { path: 'settlements', loadComponent: () => import('./settlements/settlements-list.component') },
  { path: 'settlements/:id', loadComponent: () => import('./settlements/settlement-detail.component') },
  { path: 'products', loadComponent: () => import('./products/product-list.component') },
  { path: 'products/new', loadComponent: () => import('./products/product-form.component') },
  {
    path: 'products/bull/:bullId/edit',
    loadComponent: () => import('./products/product-form.component'),
  },
  { path: 'products/:id/edit', loadComponent: () => import('./products/product-form.component') },
  { path: 'branches', loadComponent: () => import('./branches/branch-list.component') },
  { path: 'branches/new', loadComponent: () => import('./branches/branch-form.component') },
  { path: 'branches/:id/edit', loadComponent: () => import('./branches/branch-form.component') },
  { path: 'inventory', loadComponent: () => import('./inventory/inventory-list.component') },
  {
    path: 'inventory/:itemId',
    loadComponent: () => import('./inventory/inventory-detail.component'),
  },
  { path: 'orders', loadComponent: () => import('./orders/orders-list.component') },
  { path: 'orders/:id', loadComponent: () => import('./orders/order-detail.component') },
  {
    path: 'legal-documents',
    loadComponent: () => import('./legal-documents/seller-legal-documents.component'),
  },
  { path: 'settings', loadComponent: () => import('./settings/seller-settings.component') },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
