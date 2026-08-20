import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CartStore } from '../../../../core/store/cart.store';
import { PaymentService, PaymentStatusResponse } from '../../../../core/services/payment.service';
import { OrderService } from '../../../../core/services/order.service';
import { Order } from '../../../../core/models/order.model';
import { WompiCheckoutService } from '../../../../core/services/wompi-checkout.service';
import { PricePipe } from '../../../../shared/pipes/price.pipe';

const CHECKOUT_STORAGE_KEY = 'tauru_checkout_form';

/**
 * Purely informational — never derives the payment outcome from the Wompi
 * widget/redirect itself (proposal §21). It polls/subscribes to the
 * backend-confirmed order status (set only by the validated webhook) and
 * reflects that, alongside a full order summary (RLS-scoped read via
 * OrderService.getOne, same as the order-detail page).
 */
@Component({
  selector: 'app-checkout-result',
  standalone: true,
  imports: [RouterLink, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-surface flex items-center justify-center px-4 py-12 sm:py-16">
      <div class="w-full max-w-2xl card p-8 sm:p-12 text-center space-y-8">
        @switch (view()) {
          @case ('loading') {
            <div class="animate-spin mx-auto w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full"></div>
            <p class="text-gray-500">Cargando tu orden...</p>
          }
          @case ('verifying') {
            <div class="space-y-4">
              <div class="animate-spin mx-auto w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"></div>
              <h1 class="text-2xl font-bold text-gray-900">Estamos verificando tu pago...</h1>
              <p class="text-base text-gray-500 max-w-md mx-auto">
                Esto puede tardar unos segundos. No cierres ni recargues esta página.
              </p>
            </div>
          }
          @case ('paid') {
            <div class="space-y-4">
              <div class="w-20 h-20 mx-auto bg-secondary/10 rounded-full flex items-center justify-center">
                <svg class="w-10 h-10 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-gray-900">¡Pago aprobado!</h1>
              <p class="text-base text-gray-500 max-w-md mx-auto">
                Tu orden fue confirmada. Te avisaremos cuando esté lista para recoger.
              </p>
            </div>
          }
          @case ('failed') {
            <div class="space-y-4">
              <div class="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center">
                <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-gray-900">Tu pago no pudo procesarse</h1>
              <p class="text-base text-gray-500 max-w-md mx-auto">Puedes intentarlo de nuevo sin perder tu orden.</p>
              @if (failureReason()) {
                <p class="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5 inline-block">{{ failureReason() }}</p>
              }
              @if (errorMsg()) {
                <p class="text-sm text-red-500">{{ errorMsg() }}</p>
              }
              <div>
                <button (click)="retry()" [disabled]="retrying()" class="btn-primary px-6 py-3 text-sm">
                  {{ retrying() ? 'Abriendo pago...' : 'Reintentar pago' }}
                </button>
              </div>
            </div>
          }
          @case ('pending') {
            <div class="space-y-4">
              <div class="w-20 h-20 mx-auto bg-accent/10 rounded-full flex items-center justify-center">
                <svg class="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-gray-900">Tu orden quedó pendiente de pago</h1>
              <p class="text-base text-gray-500 max-w-md mx-auto">Puedes reintentar el pago desde "Mis compras" cuando quieras.</p>
            </div>
          }
          @case ('error') {
            <div class="space-y-4">
              <h1 class="text-2xl font-bold text-gray-900">No pudimos cargar esta orden</h1>
              <p class="text-base text-gray-500 max-w-md mx-auto">Revisa "Mis compras" para ver el estado de tus pedidos.</p>
            </div>
          }
        }

        @if (order(); as o) {
          <div class="border-t border-gray-100 pt-6 text-left space-y-4">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-gray-900">Orden #{{ o.id.slice(0, 8).toUpperCase() }}</p>
              <p class="text-xs text-gray-400">{{ o.total | price }}</p>
            </div>

            <div class="space-y-2.5">
              @for (item of o.items; track item.id) {
                <div class="flex items-center justify-between text-sm">
                  <div>
                    <p class="text-gray-900 font-medium">{{ item.productName }}</p>
                    <p class="text-gray-400 text-xs">{{ item.quantity }} × {{ item.unitPrice | price }}</p>
                  </div>
                  <p class="text-gray-900 font-semibold">{{ item.subtotal | price }}</p>
                </div>
              }
            </div>

            <div class="border-t border-gray-100 pt-3 space-y-1 text-sm">
              <div class="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{{ o.subtotal | price }}</span>
              </div>
              @if (o.discount > 0) {
                <div class="flex justify-between text-gray-500">
                  <span>Descuento</span><span>-{{ o.discount | price }}</span>
                </div>
              }
              <div class="flex justify-between text-gray-500">
                <span>Envío</span><span>{{ o.shippingCost | price }}</span>
              </div>
              <div class="flex justify-between text-gray-900 font-bold text-base pt-1">
                <span>Total</span><span>{{ o.total | price }}</span>
              </div>
            </div>
          </div>
        }

        @if (view() === 'paid' || view() === 'pending' || view() === 'error') {
          <a routerLink="/orders" class="btn-primary inline-block px-6 py-3 text-sm">Ver mis compras</a>
        }
      </div>
    </div>
  `,
})
export default class CheckoutResultComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private cartStore = inject(CartStore);
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private wompiCheckout = inject(WompiCheckoutService);

  view = signal<'loading' | 'verifying' | 'paid' | 'failed' | 'pending' | 'error'>('loading');
  status = signal<PaymentStatusResponse | null>(null);
  order = signal<Order | null>(null);
  errorMsg = signal<string | null>(null);
  retrying = signal(false);

  failureReason(): string | null {
    return this.status()?.payments?.[0]?.failure_reason ?? null;
  }

  private orderId: string | null = null;
  private stopWatching: (() => void) | null = null;
  private cartCleared = false;

  ngOnInit(): void {
    this.orderId = this.route.snapshot.queryParamMap.get('orderId');
    if (!this.orderId) {
      this.view.set('error');
      return;
    }
    void this.refresh();
    if (isPlatformBrowser(this.platformId)) {
      this.stopWatching = this.paymentService.watchOrder(this.orderId, () => void this.refresh());
    }
  }

  ngOnDestroy(): void {
    this.stopWatching?.();
  }

  private async refresh(): Promise<void> {
    if (!this.orderId) return;
    try {
      const [status, order] = await Promise.all([
        this.paymentService.getStatus(this.orderId),
        firstValueFrom(this.orderService.getOne(this.orderId)),
      ]);
      this.status.set(status);
      this.order.set(order);
      this.applyStatus(status.orderStatus);
    } catch {
      if (this.view() === 'loading') this.view.set('error');
    }
  }

  private applyStatus(orderStatus: PaymentStatusResponse['orderStatus']): void {
    switch (orderStatus) {
      case 'PAID':
      case 'PROCESSING':
      case 'SHIPPED':
      case 'COMPLETED':
        this.view.set('paid');
        this.clearCartOnce();
        break;
      case 'PAYMENT_FAILED':
        this.view.set('failed');
        break;
      case 'PAYMENT_PROCESSING':
        this.view.set('verifying');
        break;
      case 'PENDING_PAYMENT':
      case 'EXPIRED':
      case 'CANCELLED':
        this.view.set('pending');
        break;
    }
  }

  /** Cart is only ever cleared once the backend-confirmed status is a paid/fulfilled one — never on widget/redirect data. */
  private clearCartOnce(): void {
    if (this.cartCleared) return;
    this.cartCleared = true;
    this.cartStore.clear();
    if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
  }

  async retry(): Promise<void> {
    if (!this.orderId) return;
    this.retrying.set(true);
    this.errorMsg.set(null);
    try {
      const intent = await this.orderService.retryPayment(this.orderId);
      this.view.set('verifying');
      await this.wompiCheckout.open(intent, () => void this.refresh());
    } catch {
      this.errorMsg.set('No se pudo reintentar el pago. Intenta de nuevo.');
      this.view.set('failed');
    } finally {
      this.retrying.set(false);
    }
  }
}
