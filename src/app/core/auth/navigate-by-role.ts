import { Router } from '@angular/router';
import { UserRole } from '../models/user.model';

/** The default landing route for a role. */
export function roleHomeCommands(role: UserRole | undefined): string[] {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return ['/admin'];
  if (role === 'SELLER') return ['/seller/products'];
  return ['/'];
}

export function navigateByRole(router: Router, role: UserRole | undefined): void {
  router.navigate(roleHomeCommands(role));
}
