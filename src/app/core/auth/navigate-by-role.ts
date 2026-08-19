import { Router } from '@angular/router';
import { UserRole } from '../models/user.model';

const CHECKOUT_RETURN_KEY = 'tauru_return_to_checkout';

/**
 * Se llama cuando `authGuard` bloquea un intento de entrar a /checkout sin
 * sesión, para que el login (por cualquier vía — email, Google, o registro)
 * pueda mandar de vuelta ahí en vez de al home del rol. sessionStorage en vez
 * de un query param: sobrevive el ida-y-vuelta completo a Google y la cadena
 * registro → verificar-email → sign-in sin tener que hacerlo viajar a mano
 * por cada salto.
 */
export function markCheckoutReturn(): void {
  if (typeof window !== 'undefined') sessionStorage.setItem(CHECKOUT_RETURN_KEY, '1');
}

function consumeCheckoutReturn(): boolean {
  if (typeof window === 'undefined') return false;
  if (!sessionStorage.getItem(CHECKOUT_RETURN_KEY)) return false;
  sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
  return true;
}

/** The default landing route for a role. */
export function roleHomeCommands(role: UserRole | undefined): string[] {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return ['/admin'];
  if (role === 'SELLER') return ['/seller/products'];
  return ['/'];
}

/** Destino tras autenticarse: /checkout si eso fue lo que se interrumpió, si no el home del rol. */
export function postAuthCommands(role: UserRole | undefined): string[] {
  return consumeCheckoutReturn() ? ['/checkout'] : roleHomeCommands(role);
}

export function navigateByRole(router: Router, role: UserRole | undefined): void {
  router.navigate(postAuthCommands(role));
}
