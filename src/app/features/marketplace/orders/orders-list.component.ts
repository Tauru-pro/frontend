import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

const STATUS_LABELS: Record<OrderStatus, string> = {
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

const STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-accent/10 text-accent',
  PAYMENT_PROCESSING: 'bg-accent/10 text-accent',
  PAID: 'bg-secondary/10 text-secondary',
  PROCESSING: 'bg-secondary/10 text-secondary',
  SHIPPED: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-secondary/10 text-secondary',
  PAYMENT_FAILED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

@Component({
  selector: 'app-orders-list',
  standalone: true,
  host: { class: 'w-full' },
  imports: [RouterLink, PricePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Mis compras</h1>
        <p class="text-sm text-gray-500 mt-0.5">Historial y estado de tus órdenes</p>
      </div>

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-20 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{{ errorMsg() }}</div>
      } @else if (orders().length === 0) {
        <div class="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center text-center px-6">
          <p class="text-gray-800 font-semibold mb-1">Todavía no tienes compras</p>
          <p class="text-gray-400 text-sm mb-5">Cuando confirmes un pedido, aparecerá aquí.</p>
          <a routerLink="/catalog" class="btn-primary px-5 py-2.5 text-sm">Ir al catálogo</a>
        </div>
      } @else {
        <div class="space-y-3">
          @for (order of orders(); track order.id) {
            <a
              [routerLink]="['/orders', order.id]"
              class="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-primary/30 transition-colors"
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-gray-900">
                    Orden #{{ order.id.slice(0, 8).toUpperCase() }}
                  </p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ order.createdAt | date: 'd MMM yyyy, h:mm a' }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-bold text-gray-900">{{ order.total | price }}</p>
                  <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium {{ statusClass(order.status) }}">
                    {{ statusLabel(order.status) }}
                  </span>
                </div>
              </div>
            </a>
          }
        </div>

        @if (totalPages() > 1) {
          <div class="flex justify-center gap-2 pt-2">
            @for (p of pageNumbers(); track p) {
              <button
                (click)="onPageChange(p)"
                class="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                [class]="p === page() ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
              >
                {{ p }}
              </button>
            }
          </div>
        }
      }
    </div>
  `,
})
export default class OrdersListComponent implements OnInit {
  private orderService = inject(OrderService);

  orders = signal<Order[]>([]);
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  page = signal(1);
  totalPages = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.orderService.getMyOrders(this.page(), 10).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudieron cargar tus compras. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.load();
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  statusLabel(status: OrderStatus): string {
    return STATUS_LABELS[status];
  }

  statusClass(status: OrderStatus): string {
    return STATUS_CLASSES[status];
  }
}
