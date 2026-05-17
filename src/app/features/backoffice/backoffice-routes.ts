import { Routes } from '@angular/router';
import { RoutesApp } from '../../shared/const/routes';
export default <Routes>[
  { path: RoutesApp.users, loadComponent: () => import('./users/users.component') },
  { path: `${RoutesApp.users}/new`, loadComponent: () => import('./users/user-form.component') },
  { path: `${RoutesApp.users}/:id/edit`, loadComponent: () => import('./users/user-form.component') },
  { path: RoutesApp.sellers, loadComponent: () => import('./sellers/sellers.component') },
  { path: RoutesApp.pickupPoints, loadComponent: () => import('./pickup-points/pickup-points.component') },
  { path: `${RoutesApp.pickupPoints}/new`, loadComponent: () => import('./pickup-points/pickup-point-form.component') },
  { path: `${RoutesApp.pickupPoints}/:id/edit`, loadComponent: () => import('./pickup-points/pickup-point-form.component') },
  { path: RoutesApp.shippingRates, loadComponent: () => import('./shipping-rates/shipping-rates.component') },
  { path: `${RoutesApp.shippingRates}/new`, loadComponent: () => import('./shipping-rates/shipping-rate-form.component') },
  { path: `${RoutesApp.shippingRates}/:id/edit`, loadComponent: () => import('./shipping-rates/shipping-rate-form.component') },
  { path: RoutesApp.breeds, loadComponent: () => import('./breeds/breeds.component') },
  { path: `${RoutesApp.breeds}/new`, loadComponent: () => import('./breeds/breed-form.component') },
  { path: `${RoutesApp.breeds}/:id/edit`, loadComponent: () => import('./breeds/breed-form.component') },
  { path: RoutesApp.settings, loadComponent: () => import('./settings/marketplace-settings.component') },
  { path: RoutesApp.dashboard, loadComponent: () => import('./dashboard/dashboard.component') },
  { path: '', redirectTo: RoutesApp.dashboard, pathMatch: 'full' },
];
