import { Routes } from '@angular/router';
import { HomeLayoutComponent } from './shared/layouts/home-layout.component';
import { BackofficeLayoutComponent } from './shared/layouts/backoffice-layout.component';
import { SellerLayoutComponent } from './shared/layouts/seller-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { sellerGuard } from './core/guards/seller.guard';

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
    component: SellerLayoutComponent,
    canActivate: [sellerGuard],
    loadChildren: () => import('./features/seller/seller-routes'),
  },
  { path: '**', redirectTo: '' },
];
