import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Order, OrderStatus, PaymentStatus } from '../../../core/models/order.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAYMENT_PROCESSING: 'Procesando pago',
  PAID: 'Pagada',
  PROCESSING: 'En preparación',
  SHIPPED: 'Enviada',
  COMPLETED: 'Completada',
  PAYMENT_FAILED: 'Pago fallido',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  CREATED: 'Creado',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  VOIDED: 'Anulado',
  ERROR: 'Error',
  EXPIRED: 'Expirado',
};

/** Buyer-facing order detail — RLS already scopes reads to the caller's own orders. */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  host: { class: 'w-full' },
  imports: [RouterLink, PricePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <a routerLink="/orders" class="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Mis compras
      </a>

      @if (loading()) {
        <div class="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else if (!order()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          No se pudo cargar esta orden.
        </div>
      } @else {
        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-lg font-bold text-gray-900">Orden #{{ order()!.id.slice(0, 8).toUpperCase() }}</h1>
              <p class="text-xs text-gray-400 mt-0.5">{{ order()!.createdAt | date: 'd MMM yyyy, h:mm a' }}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium {{ statusClass(order()!.status) }}">
              {{ orderStatusLabel(order()!.status) }}
            </span>
          </div>

          <div class="space-y-3">
            @for (item of order()!.items; track item.id) {
              <div class="flex items-center justify-between text-sm">
                <div>
                  <p class="text-gray-900 font-medium">{{ item.productName }}</p>
                  <p class="text-gray-400 text-xs">{{ item.quantity }} × {{ item.unitPrice | price }}</p>
                </div>
                <p class="text-gray-900 font-semibold">{{ item.subtotal | price }}</p>
              </div>
            }
          </div>

          <div class="border-t border-gray-100 pt-4 space-y-1.5 text-sm">
            <div class="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{{ order()!.subtotal | price }}</span>
            </div>
            @if (order()!.discount > 0) {
              <div class="flex justify-between text-gray-500">
                <span>Descuento</span><span>-{{ order()!.discount | price }}</span>
              </div>
            }
            @if (order()!.tax > 0) {
              <div class="flex justify-between text-gray-500">
                <span>Impuestos</span><span>{{ order()!.tax | price }}</span>
              </div>
            }
            <div class="flex justify-between text-gray-500">
              <span>Envío</span><span>{{ order()!.shippingCost | price }}</span>
            </div>
            <div class="flex justify-between text-gray-900 font-bold text-base pt-1">
              <span>Total</span><span>{{ order()!.total | price }}</span>
            </div>
          </div>

          @if (order()!.payment) {
            <div class="border-t border-gray-100 pt-4 text-sm space-y-1">
              <div class="flex justify-between">
                <span class="text-gray-500">Estado del pago</span>
                <span class="text-gray-900 font-medium">{{ paymentStatusLabel(order()!.payment!.status) }}</span>
              </div>
              @if (order()!.payment!.paymentMethod) {
                <div class="flex justify-between">
                  <span class="text-gray-500">Método de pago</span>
                  <span class="text-gray-900 font-medium">{{ order()!.payment!.paymentMethod }}</span>
                </div>
              }
            </div>
          }

          @if (order()!.status === 'PAYMENT_FAILED') {
            <a routerLink="/checkout/result" [queryParams]="{ orderId: order()!.id }" class="btn-primary inline-block px-5 py-2.5 text-sm">
              Reintentar pago
            </a>
          }
        </div>
      }
    </div>
  `,
})
export default class OrderDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);

  order = signal<Order | null>(null);
  loading = signal(false);

  private stopWatching: (() => void) | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.load(id);
    if (isPlatformBrowser(this.platformId)) {
      this.stopWatching = this.paymentService.watchOrder(id, () => this.load(id));
    }
  }

  ngOnDestroy(): void {
    this.stopWatching?.();
  }

  private load(id: string): void {
    this.loading.set(true);
    this.orderService.getOne(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  orderStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status];
  }

  paymentStatusLabel(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status];
  }

  statusClass(status: OrderStatus): string {
    if (status === 'PAID' || status === 'PROCESSING' || status === 'COMPLETED') return 'bg-secondary/10 text-secondary';
    if (status === 'SHIPPED') return 'bg-primary/10 text-primary';
    if (status === 'PAYMENT_FAILED') return 'bg-red-50 text-red-600';
    if (status === 'CANCELLED' || status === 'EXPIRED') return 'bg-gray-100 text-gray-500';
    return 'bg-accent/10 text-accent';
  }
}
