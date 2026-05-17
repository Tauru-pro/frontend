import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserStore } from '../store/user.store';

export const adminGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);
  const userStore = inject(UserStore);

  if (!isPlatformBrowser(platformId)) return true;

  const user = await authService.loadCurrentUser();
  if (!user) return router.createUrlTree(['/auth/sign-in']);

  if (!userStore.user()) await userStore.loadUser();

  if (userStore.user()?.role !== 'ADMIN') return router.createUrlTree(['/']);

  return true;
};
