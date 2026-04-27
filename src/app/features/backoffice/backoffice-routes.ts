import { Routes } from '@angular/router';

export default <Routes>[
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component') },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
