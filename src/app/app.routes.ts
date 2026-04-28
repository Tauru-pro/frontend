import { BackofficeLayoutComponent } from './shared/layouts/backoffice-layout.component';
import { HomeLayoutComponent } from './shared/layouts/home-layout.component';
import { sellerGuard } from './core/guards/seller.guard';
import { adminGuard } from './core/guards/admin.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    component: HomeLayoutComponent,
    loadChildren: () => import('./features/marketplace/marketplace-routes'),
  },
  {
    path: 'auth',
    component: HomeLayoutComponent,
    loadChildren: () => import('./features/auth/auth-routes'),
  },
  {
    path: 'admin',
    component: BackofficeLayoutComponent,
    canActivate: [adminGuard],
    loadChildren: () => import('./features/backoffice/backoffice-routes'),
  },
  {
    path: 'seller',
    component: BackofficeLayoutComponent,
    canActivate: [sellerGuard],
    loadChildren: () => import('./features/seller/seller-routes'),
  },
  { path: '**', redirectTo: '' },
];
