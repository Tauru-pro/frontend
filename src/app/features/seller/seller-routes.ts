import { Routes } from '@angular/router';

export default <Routes>[
  {
    path: 'products',
    loadComponent: () => import('./products/product-list.component'),
  },
  {
    path: 'products/new',
    loadComponent: () => import('./products/product-form.component'),
  },
  {
    path: 'products/:id/edit',
    loadComponent: () => import('./products/product-form.component'),
  },
  {
    path: 'bulls',
    loadComponent: () => import('./bulls/bull-list.component'),
  },
  {
    path: 'bulls/new',
    loadComponent: () => import('./bulls/bull-form.component'),
  },
  {
    path: 'bulls/:id/edit',
    loadComponent: () => import('./bulls/bull-form.component'),
  },
  { path: 'settings', loadComponent: () => import('./settings/seller-settings.component') },
  { path: '', redirectTo: 'products', pathMatch: 'full' },
];
