import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserStore } from '../store/user.store';
import { markCheckoutReturn } from '../auth/navigate-by-role';

export const authGuard: CanActivateFn = async (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);
  const userStore = inject(UserStore);

  if (!isPlatformBrowser(platformId)) return true;

  const user = await authService.loadCurrentUser();
  if (!user) {
    if (state.url.startsWith('/checkout')) markCheckoutReturn();
    return router.createUrlTree(['/auth/sign-in']);
  }

  return true;
};
