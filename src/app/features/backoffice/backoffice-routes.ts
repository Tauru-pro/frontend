import { Routes } from '@angular/router';
import { RoutesApp } from '../../shared/const/routes';
import { superAdminGuard } from '../../core/guards/super-admin.guard';
export default <Routes>[
  { path: RoutesApp.users, canActivate: [superAdminGuard], loadComponent: () => import('./users/users.component') },
  { path: `${RoutesApp.users}/new`, canActivate: [superAdminGuard], loadComponent: () => import('./users/user-form.component') },
  { path: `${RoutesApp.users}/:id/edit`, canActivate: [superAdminGuard], loadComponent: () => import('./users/user-form.component') },
  { path: RoutesApp.sellers, loadComponent: () => import('./sellers/sellers.component') },
  { path: RoutesApp.pickupPoints, loadComponent: () => import('./pickup-points/pickup-points.component') },
  { path: `${RoutesApp.pickupPoints}/new`, loadComponent: () => import('./pickup-points/pickup-point-form.component') },
  { path: `${RoutesApp.pickupPoints}/:id/edit`, loadComponent: () => import('./pickup-points/pickup-point-form.component') },
  { path: RoutesApp.shippingRates, loadComponent: () => import('./shipping-rates/shipping-rates.component') },
  { path: `${RoutesApp.shippingRates}/new`, loadComponent: () => import('./shipping-rates/shipping-rate-form.component') },
  { path: `${RoutesApp.shippingRates}/:id/edit`, loadComponent: () => import('./shipping-rates/shipping-rate-form.component') },
  { path: RoutesApp.breeds, canActivate: [superAdminGuard], loadComponent: () => import('./breeds/breeds.component') },
  { path: `${RoutesApp.breeds}/new`, canActivate: [superAdminGuard], loadComponent: () => import('./breeds/breed-form.component') },
  { path: `${RoutesApp.breeds}/:id/edit`, canActivate: [superAdminGuard], loadComponent: () => import('./breeds/breed-form.component') },
  { path: 'products', canActivate: [superAdminGuard], loadComponent: () => import('./products/products.component') },
  { path: RoutesApp.settings, loadComponent: () => import('./settings/marketplace-settings.component') },
  { path: RoutesApp.dashboard, loadComponent: () => import('./dashboard/dashboard.component') },
  { path: '', redirectTo: RoutesApp.dashboard, pathMatch: 'full' },
];
