import { Routes } from '@angular/router';
import { HomeLayoutComponent } from './shared/layouts/home-layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: HomeLayoutComponent,
    canActivate: [authGuard],
    loadChildren: () => import('./features/marketplace/marketplace-routes'),
  },
  {
    path: 'auth',
    component: HomeLayoutComponent,
    loadChildren: () => import('./features/auth/auth-routes'),
  },
  { path: '**', redirectTo: '' },
];
