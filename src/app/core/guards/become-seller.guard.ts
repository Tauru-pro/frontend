import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserStore } from '../store/user.store';

// Provider onboarding requires an account: no session -> sign-up (and return
// after). Already a SELLER -> straight to the panel. Any other privileged role
// -> home. Only a CUSTOMER may start the flow.
export const becomeSellerGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);
  const userStore = inject(UserStore);

  if (!isPlatformBrowser(platformId)) return true;

  const user = await authService.loadCurrentUser();
  if (!user) return router.createUrlTree(['/auth/sign-up']);

  if (!userStore.user()) await userStore.loadUser();
  const role = userStore.user()?.role;

  if (role === 'SELLER') return router.createUrlTree(['/seller']);
  if (role !== 'CUSTOMER') return router.createUrlTree(['/']);
  return true;
};
