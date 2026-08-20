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
import { Router } from '@angular/router';
import { SellerOrderService } from '../../../core/services/seller-order.service';
import {
  FulfillmentStatus,
  SellerOrderFilters,
  SellerOrderSummary,
} from '../../../core/models/seller-order.model';
import { PaymentStatus } from '../../../core/models/order.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  RECEIVED: 'Nueva',
  PROCESSING: 'En preparación',
  SHIPPED: 'Enviada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const FULFILLMENT_CLASSES: Record<FulfillmentStatus, string> = {
  RECEIVED: 'bg-accent/10 text-accent',
  PROCESSING: 'bg-secondary/10 text-secondary',
  SHIPPED: 'bg-primary/10 text-primary',
  COMPLETED: 'bg-secondary/10 text-secondary',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  CREATED: 'Creado',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  VOIDED: 'Anulado',
  ERROR: 'Error',
  EXPIRED: 'Expirado',
};

interface CounterCard {
  status: FulfillmentStatus;
  label: string;
}

const COUNTER_CARDS: CounterCard[] = [
  { status: 'RECEIVED', label: 'Nuevas' },
  { status: 'PROCESSING', label: 'En preparación' },
  { status: 'SHIPPED', label: 'Enviadas' },
  { status: 'COMPLETED', label: 'Completadas' },
];

@Component({
  selector: 'app-seller-orders-list',
  imports: [DatePipe, PricePipe, DataTableComponent, TableCellDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Órdenes</h1>
        <p class="text-sm text-gray-500 mt-0.5">Órdenes que incluyen tus productos</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        @for (card of counterCards; track card.status) {
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-2xl font-bold text-gray-900">{{ counts()[card.status] }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ card.label }}</p>
          </div>
        }
      </div>

      <div
        class="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Estado de preparación</label>
          <select
            [value]="filters().status ?? ''"
            (change)="updateFilter('status', $any($event.target).value || undefined)"
            class="form-input w-full"
          >
            <option value="">Todos</option>
            @for (s of fulfillmentStatuses; track s) {
              <option [value]="s">{{ fulfillmentLabel(s) }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Estado de pago</label>
          <select
            [value]="filters().paymentStatus ?? ''"
            (change)="updateFilter('paymentStatus', $any($event.target).value || undefined)"
            class="form-input w-full"
          >
            <option value="">Todos</option>
            @for (s of paymentStatuses; track s) {
              <option [value]="s">{{ paymentLabel(s) }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input
            type="date"
            [value]="filters().dateFrom ?? ''"
            (change)="updateFilter('dateFrom', $any($event.target).value || undefined)"
            class="form-input w-full"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            [value]="filters().dateTo ?? ''"
            (change)="updateFilter('dateTo', $any($event.target).value || undefined)"
            class="form-input w-full"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
          <input
            type="text"
            placeholder="N° de orden o comprador"
            [value]="filters().search ?? ''"
            (change)="updateFilter('search', $any($event.target).value || undefined)"
            class="form-input w-full"
          />
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="orders()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="órdenes"
        (pageChange)="onPageChange($event)"
      >
        <ng-template tableCell="order" let-o>
          <span class="font-medium text-gray-900">#{{ o.orderId.slice(0, 8).toUpperCase() }}</span>
        </ng-template>

        <ng-template tableCell="date" let-o>
          <span class="text-gray-600 text-sm">{{ o.createdAt | date: 'd MMM yyyy, h:mm a' }}</span>
        </ng-template>

        <ng-template tableCell="buyer" let-o>
          <span class="text-gray-900 text-sm">{{ o.buyerName }}</span>
        </ng-template>

        <ng-template tableCell="items" let-o>
          <span class="text-gray-600 text-sm">{{ o.itemCount }}</span>
        </ng-template>

        <ng-template tableCell="subtotal" let-o>
          <span class="font-semibold text-gray-900">{{ o.sellerSubtotal | price }}</span>
        </ng-template>

        <ng-template tableCell="paymentStatus" let-o>
          <span class="text-gray-600 text-sm">{{
            o.paymentStatus ? paymentLabel(o.paymentStatus) : '—'
          }}</span>
        </ng-template>

        <ng-template tableCell="fulfillmentStatus" let-o>
          <span
            class="px-2.5 py-0.5 rounded-full text-xs font-medium {{
              fulfillmentClass(o.fulfillmentStatus)
            }}"
          >
            {{ fulfillmentLabel(o.fulfillmentStatus) }}
          </span>
        </ng-template>

        <ng-template tableCell="updatedAt" let-o>
          <span class="text-gray-500 text-xs">{{
            o.fulfillmentUpdatedAt | date: 'd MMM, h:mm a'
          }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-o>
          <button
            type="button"
            (click)="router.navigate(['/seller/orders', o.orderId])"
            class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
            title="Ver detalle"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg
                class="w-7 h-7 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin órdenes todavía</p>
            <p class="text-gray-400 text-sm">
              Cuando un comprador pague por uno de tus productos, aparecerá aquí.
            </p>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class SellerOrdersListComponent implements OnInit, OnDestroy {
  protected router = inject(Router);
  private sellerOrderService = inject(SellerOrderService);
  private platformId = inject(PLATFORM_ID);

  readonly columns: TableColumn<SellerOrderSummary>[] = [
    { key: 'order', label: 'Orden', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'date', label: 'Fecha' },
    { key: 'buyer', label: 'Comprador' },
    { key: 'items', label: 'Ítems' },
    { key: 'subtotal', label: 'Tu subtotal' },
    { key: 'paymentStatus', label: 'Pago' },
    { key: 'fulfillmentStatus', label: 'Estado' },
    { key: 'updatedAt', label: 'Actualizado' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-16' },
  ];

  readonly fulfillmentStatuses: FulfillmentStatus[] = [
    'RECEIVED',
    'PROCESSING',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED',
  ];
  readonly paymentStatuses: PaymentStatus[] = [
    'APPROVED',
    'PENDING',
    'DECLINED',
    'ERROR',
    'VOIDED',
    'EXPIRED',
  ];
  readonly counterCards = COUNTER_CARDS;

  orders = signal<SellerOrderSummary[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  filters = signal<SellerOrderFilters>({});
  counts = signal<Record<FulfillmentStatus, number>>({
    RECEIVED: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  });

  private stopWatching: (() => void) | null = null;

  ngOnInit(): void {
    this.load();
    this.loadCounts();
    if (isPlatformBrowser(this.platformId)) {
      this.stopWatching = this.sellerOrderService.watchFulfillments(() => {
        this.load();
        this.loadCounts();
      });
    }
  }

  ngOnDestroy(): void {
    this.stopWatching?.();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const res = await this.sellerOrderService.getOrders(this.filters(), this.page(), 20);
      this.orders.set(res.data);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } catch {
      this.errorMsg.set('No se pudieron cargar las órdenes. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  /** One lightweight get_seller_orders call per status, page size 1 — reads its `total`, never a separately-maintained counter. */
  async loadCounts(): Promise<void> {
    const base = this.filters();
    const results = await Promise.all(
      this.fulfillmentStatuses.map((status) =>
        this.sellerOrderService.getOrders({ ...base, status }, 1, 1).catch(() => ({ total: 0 })),
      ),
    );
    const next = { ...this.counts() };
    this.fulfillmentStatuses.forEach((status, i) => {
      next[status] = results[i].total;
    });
    this.counts.set(next);
  }

  updateFilter<K extends keyof SellerOrderFilters>(key: K, value: SellerOrderFilters[K]): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
    this.load();
    this.loadCounts();
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.load();
  }

  fulfillmentLabel(status: FulfillmentStatus): string {
    return FULFILLMENT_LABELS[status];
  }

  fulfillmentClass(status: FulfillmentStatus): string {
    return FULFILLMENT_CLASSES[status];
  }

  paymentLabel(status: PaymentStatus): string {
    return PAYMENT_LABELS[status];
  }
}
