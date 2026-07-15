import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserStore } from '../store/user.store';
import { roleHomeCommands } from '../auth/navigate-by-role';

// Guest-only routes (sign-in / sign-up): an authenticated user is redirected to
// their role's home instead of seeing login/registration.
export const guestGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const userStore = inject(UserStore);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) return true;

  const user = await authService.loadCurrentUser();
  if (!user) return true; // not authenticated → allow login/register

  if (!userStore.user()) await userStore.loadUser();
  return router.createUrlTree(roleHomeCommands(userStore.user()?.role));
};
