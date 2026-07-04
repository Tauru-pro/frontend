import { Routes } from '@angular/router';

export default <Routes>[
  { path: 'products', loadComponent: () => import('./products/product-list.component') },
  { path: 'products/new', loadComponent: () => import('./products/product-form.component') },
  { path: 'products/:id/edit', loadComponent: () => import('./products/product-form.component') },
  { path: 'bulls', loadComponent: () => import('./bulls/bull-list.component') },
  { path: 'bulls/new', loadComponent: () => import('./bulls/bull-form.component') },
  { path: 'bulls/:id/edit', loadComponent: () => import('./bulls/bull-form.component') },
  { path: 'supplies', loadComponent: () => import('./supplies/supply-list.component') },
  { path: 'supplies/new', loadComponent: () => import('./supplies/supply-form.component') },
  { path: 'supplies/:id/edit', loadComponent: () => import('./supplies/supply-form.component') },
  { path: 'branches', loadComponent: () => import('./branches/branch-list.component') },
  { path: 'branches/new', loadComponent: () => import('./branches/branch-form.component') },
  { path: 'branches/:id/edit', loadComponent: () => import('./branches/branch-form.component') },
  { path: 'settings', loadComponent: () => import('./settings/seller-settings.component') },
  { path: '', redirectTo: 'products', pathMatch: 'full' },
];
