import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const user = await inject(AuthService).loadCurrentUser();
  if (user) return true;
  return inject(Router).createUrlTree(['/auth/sign-in']);
};
