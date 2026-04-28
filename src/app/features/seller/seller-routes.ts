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
  { path: '', redirectTo: 'products', pathMatch: 'full' },
];
