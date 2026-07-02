import { Router } from '@angular/router';
import { UserRole } from '../models/user.model';

export function navigateByRole(router: Router, role: UserRole | undefined): void {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') router.navigate(['/admin']);
  else if (role === 'SELLER') router.navigate(['/seller/products']);
  else router.navigate(['/']);
}
