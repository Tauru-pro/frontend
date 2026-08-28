import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { SellerDashboardService } from '../../../core/services/seller-dashboard.service';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { CommissionRuleService } from '../../../core/services/commission-rule.service';
import { SellerOrderService } from '../../../core/services/seller-order.service';
import { UserStore } from '../../../core/store/user.store';
import {
  DASHBOARD_PERIOD_LABELS,
  DashboardPeriod,
  resolveDateRange,
  SellerDashboardSummary,
} from '../../../core/models/seller-dashboard.model';
import { SellerOrderSummary } from '../../../core/models/seller-order.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-seller-dashboard',
  imports: [PricePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Panel financiero</h1>
          <p class="text-sm text-gray-500 mt-0.5">Resumen de ventas y estado de tus liquidaciones</p>
        </div>
        <select
          (change)="onPeriodChange($any($event.target).value)"
          class="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
        >
          @for (opt of periodOptions; track opt) {
            <option [value]="opt" [selected]="opt === period()">{{ periodLabels[opt] }}</option>
          }
        </select>
      </div>

      @if (period() === 'CUSTOM') {
        <div class="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <input
            type="date"
            [value]="customFrom()"
            (change)="customFrom.set($any($event.target).value); reload()"
            class="border border-gray-200 rounded-xl px-3 py-2 text-sm"
          />
          <span class="text-gray-400 text-sm">a</span>
          <input
            type="date"
            [value]="customTo()"
            (change)="customTo.set($any($event.target).value); reload()"
            class="border border-gray-200 rounded-xl px-3 py-2 text-sm"
          />
        </div>
      }

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      @if (loading()) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else if (summary(); as s) {

        <!-- Resumen de ventas -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Ventas brutas</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ s.grossSales | price }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Pedidos</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ s.ordersCount }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Dosis vendidas</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ s.dosesSold }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Ticket promedio</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ s.averageOrderValue | price }}</p>
          </div>
        </div>

        <!-- Información financiera -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Total recaudado</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ s.totalCollected | price }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Comisiones</p>
            <p class="text-lg font-bold text-gray-900 mt-1">{{ s.platformCommission | price }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Neto de ventas</p>
            <p class="text-lg font-bold text-primary mt-1">{{ s.sellerNet | price }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Por liquidar</p>
            <p class="text-lg font-bold text-accent mt-1">{{ s.pendingSettlement | price }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <p class="text-xs text-gray-400">Liquidado</p>
            <p class="text-lg font-bold text-secondary mt-1">{{ s.settledAmount | price }}</p>
          </div>
        </div>
      }

      <!-- Segmento y comisión (informativo, no editable) -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-400">Segmento</p>
          <p class="text-sm font-semibold text-gray-900 mt-0.5">{{ segmentName() ?? 'Sin asignar' }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-400">Comisión de plataforma</p>
          <p class="text-sm font-semibold text-gray-900 mt-0.5">
            {{ commissionRate() !== null ? commissionRate() + '%' : 'Pendiente de asignación' }}
          </p>
        </div>
        <button
          (click)="router.navigate(['/seller/settlements'])"
          class="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
        >
          Ver liquidaciones
        </button>
      </div>

      <!-- Pedidos recientes -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
        <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Pedidos recientes</h2>
        @if (recentOrders().length === 0) {
          <p class="text-sm text-gray-400">Sin pedidos todavía.</p>
        } @else {
          <div class="divide-y divide-gray-50">
            @for (o of recentOrders(); track o.orderId) {
              <button
                (click)="router.navigate(['/seller/orders', o.orderId])"
                class="w-full py-3 flex items-center justify-between text-left hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ o.buyerName }}</p>
                  <p class="text-xs text-gray-400">{{ o.createdAt | date: 'd MMM y' }} · {{ o.itemCount }} items</p>
                </div>
                <span class="text-sm font-semibold text-gray-900">{{ o.sellerSubtotal | price }}</span>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export default class SellerDashboardComponent implements OnInit {
  protected router = inject(Router);
  private dashboardService = inject(SellerDashboardService);
  private segmentService = inject(SellerSegmentService);
  private commissionService = inject(CommissionRuleService);
  private orderService = inject(SellerOrderService);
  private userStore = inject(UserStore);
  private destroyRef = inject(DestroyRef);

  protected periodLabels = DASHBOARD_PERIOD_LABELS;
  protected periodOptions: DashboardPeriod[] = [
    'TODAY',
    'LAST_7_DAYS',
    'LAST_30_DAYS',
    'THIS_MONTH',
    'LAST_MONTH',
    'THIS_YEAR',
    'CUSTOM',
  ];

  period = signal<DashboardPeriod>('LAST_30_DAYS');
  customFrom = signal<string>(new Date().toISOString().slice(0, 10));
  customTo = signal<string>(new Date().toISOString().slice(0, 10));

  summary = signal<SellerDashboardSummary | null>(null);
  segmentName = signal<string | null>(null);
  commissionRate = signal<number | null>(null);
  recentOrders = signal<SellerOrderSummary[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  private stopWatching: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadSegmentAndCommission();
    await this.reload();
    await this.loadRecentOrders();

    const sellerId = this.userStore.user()?.sellerProfile?.id;
    if (sellerId) {
      // Realtime dedupe note: apply_payment_approved is idempotent at the
      // database level (unique index on seller_earnings), so a retried
      // Wompi webhook never produces a second row/change event here — this
      // subscription only ever fires once per real underlying change.
      this.stopWatching = this.dashboardService.watchOwnFinancials(sellerId, () => this.reload());
      this.destroyRef.onDestroy(() => this.stopWatching?.());
    }
  }

  private async loadSegmentAndCommission(): Promise<void> {
    try {
      const { segmentId, segmentName } = await this.segmentService.getOwnSegment();
      this.segmentName.set(segmentName);
      if (segmentId) {
        this.commissionRate.set(await this.commissionService.getCurrentRate(segmentId));
      }
    } catch {
      // Non-fatal — the informational panel just shows "Sin asignar".
    }
  }

  private async loadRecentOrders(): Promise<void> {
    try {
      const res = await this.orderService.getOrders({}, 1, 5);
      this.recentOrders.set(res.data);
    } catch {
      // Non-fatal — recent orders is a secondary panel.
    }
  }

  async onPeriodChange(value: string): Promise<void> {
    this.period.set(value as DashboardPeriod);
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const { from, to } = resolveDateRange(this.period(), this.customFrom(), this.customTo());
      this.summary.set(await this.dashboardService.getSummary(from, to));
    } catch {
      this.errorMsg.set('No se pudo cargar el resumen financiero. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
