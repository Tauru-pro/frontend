import { Routes } from '@angular/router';
import { RoutesApp } from '../../shared/const/routes';

export default <Routes>[
  { path: RoutesApp.users,              loadComponent: () => import('./users/users.component') },
  { path: `${RoutesApp.users}/new`,     loadComponent: () => import('./users/user-form.component') },
  { path: `${RoutesApp.users}/:id/edit`, loadComponent: () => import('./users/user-form.component') },
  { path: RoutesApp.sellers,            loadComponent: () => import('./sellers/sellers.component') },
  { path: RoutesApp.dashboard,          loadComponent: () => import('./dashboard/dashboard.component') },
  { path: '', redirectTo: RoutesApp.dashboard, pathMatch: 'full' },
];
