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
import {
  SellerOrderService,
  FulfillmentConflictError,
} from '../../../core/services/seller-order.service';
import {
  FulfillmentHistoryEntry,
  FulfillmentStatus,
  SellerOrderDetail,
} from '../../../core/models/seller-order.model';
import { PaymentStatus } from '../../../core/models/order.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

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

const ACTOR_LABELS: Record<FulfillmentHistoryEntry['actorType'], string> = {
  SELLER: 'Tú',
  SYSTEM: 'Sistema',
  ADMIN: 'Administrador',
};

const ACTOR_CLASSES: Record<FulfillmentHistoryEntry['actorType'], string> = {
  SELLER: 'bg-primary/10 text-primary',
  SYSTEM: 'bg-gray-100 text-gray-500',
  ADMIN: 'bg-accent/10 text-accent',
};

/** The next forward-transition action for a given status, if any (design.md Decision 2). */
const NEXT_ACTION: Partial<
  Record<FulfillmentStatus, { target: FulfillmentStatus; label: string }>
> = {
  RECEIVED: { target: 'PROCESSING', label: 'Marcar como en preparación' },
  PROCESSING: { target: 'SHIPPED', label: 'Marcar como enviado' },
  SHIPPED: { target: 'COMPLETED', label: 'Marcar como completado' },
};

@Component({
  selector: 'app-seller-order-detail',
  imports: [RouterLink, DatePipe, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl space-y-6">
      <a
        routerLink="/seller/orders"
        class="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Órdenes
      </a>

      @if (loading()) {
        <div class="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else if (!order()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          No se pudo cargar esta orden.
        </div>
      } @else {
        @if (actionError()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ actionError() }}
          </div>
        }

        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-lg font-bold text-gray-900">
                Orden #{{ order()!.orderId.slice(0, 8).toUpperCase() }}
              </h1>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ order()!.createdAt | date: 'd MMM yyyy, h:mm a' }}
              </p>
            </div>
            <span
              class="px-3 py-1 rounded-full text-xs font-medium {{
                fulfillmentClass(order()!.fulfillment.status)
              }}"
            >
              {{ fulfillmentLabel(order()!.fulfillment.status) }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Comprador
              </p>
              <p class="text-gray-900 font-medium">{{ order()!.buyerName }}</p>
              <p class="text-gray-500">{{ order()!.buyerEmail }}</p>
              @if (order()!.buyerPhone) {
                <p class="text-gray-500">{{ order()!.buyerPhone }}</p>
              }
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Punto de recogida
              </p>
              @if (order()!.pickupPoint) {
                <p class="text-gray-900 font-medium">{{ order()!.pickupPoint!.name }}</p>
                <p class="text-gray-500">{{ order()!.pickupPoint!.address }}</p>
              } @else {
                <p class="text-gray-400">—</p>
              }
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4 space-y-3">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Tus productos en esta orden
            </p>
            @for (item of order()!.items; track item.id) {
              <div class="flex items-center justify-between text-sm">
                <div>
                  <p class="text-gray-900 font-medium">{{ item.productName }}</p>
                  <p class="text-gray-400 text-xs">
                    {{ item.quantity }} × {{ item.unitPrice | price }}
                  </p>
                </div>
                <p class="text-gray-900 font-semibold">{{ item.subtotal | price }}</p>
              </div>
            }
            <div
              class="flex justify-between text-gray-900 font-bold text-base pt-2 border-t border-gray-50"
            >
              <span>Tu subtotal</span><span>{{ order()!.sellerSubtotal | price }}</span>
            </div>
          </div>

          @if (order()!.payment) {
            <div class="border-t border-gray-100 pt-4 text-sm space-y-1">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Pago
              </p>
              <div class="flex justify-between">
                <span class="text-gray-500">Estado</span>
                <span class="text-gray-900 font-medium">{{
                  paymentLabel(order()!.payment!.status)
                }}</span>
              </div>
              @if (order()!.payment!.paymentMethod) {
                <div class="flex justify-between">
                  <span class="text-gray-500">Método</span>
                  <span class="text-gray-900 font-medium">{{
                    order()!.payment!.paymentMethod
                  }}</span>
                </div>
              }
              <div class="flex justify-between">
                <span class="text-gray-500">Referencia</span>
                <span class="text-gray-900 font-medium">{{
                  order()!.payment!.providerReference
                }}</span>
              </div>
              @if (order()!.payment!.providerTransactionId) {
                <div class="flex justify-between">
                  <span class="text-gray-500">ID de transacción</span>
                  <span class="text-gray-900 font-medium">{{
                    order()!.payment!.providerTransactionId
                  }}</span>
                </div>
              }
              @if (order()!.payment!.approvedAt) {
                <div class="flex justify-between">
                  <span class="text-gray-500">Aprobado</span>
                  <span class="text-gray-900 font-medium">{{
                    order()!.payment!.approvedAt | date: 'd MMM yyyy, h:mm a'
                  }}</span>
                </div>
              }
            </div>
          }

          @if (
            order()!.fulfillment.status === 'CANCELLED' && order()!.fulfillment.cancelledReason
          ) {
            <div
              class="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600"
            >
              <span class="font-medium">Motivo de cancelación:</span>
              {{ order()!.fulfillment.cancelledReason }}
            </div>
          }

          @if (nextAction() || canCancel()) {
            <div class="border-t border-gray-100 pt-4 flex flex-wrap gap-3">
              @if (nextAction(); as action) {
                <button
                  type="button"
                  [disabled]="updating()"
                  (click)="onAdvance(action.target, action.label)"
                  class="btn-primary px-5 py-2.5 text-sm disabled:opacity-40"
                >
                  {{ action.label }}
                </button>
              }
              @if (canCancel()) {
                <button
                  type="button"
                  [disabled]="updating()"
                  (click)="showCancelForm.set(true)"
                  class="px-5 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 disabled:opacity-40 transition-colors"
                >
                  Cancelar orden
                </button>
              }
            </div>
          }
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <p class="text-sm font-semibold text-gray-900">Historial</p>
          @if (order()!.history.length === 0) {
            <p class="text-sm text-gray-400">Sin cambios registrados todavía.</p>
          } @else {
            <div class="space-y-3">
              @for (entry of order()!.history; track $index) {
                <div class="flex items-start gap-3 text-sm">
                  <span
                    class="mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium {{
                      actorClass(entry.actorType)
                    }}"
                  >
                    {{ actorLabel(entry.actorType) }}
                  </span>
                  <div class="flex-1">
                    <p class="text-gray-900">
                      @if (entry.fromStatus) {
                        {{ fulfillmentLabel(entry.fromStatus) }} →
                        {{ fulfillmentLabel(entry.toStatus) }}
                      } @else {
                        {{ fulfillmentLabel(entry.toStatus) }}
                      }
                    </p>
                    @if (entry.reason) {
                      <p class="text-gray-500 text-xs mt-0.5">{{ entry.reason }}</p>
                    }
                    <p class="text-gray-400 text-xs mt-0.5">
                      {{ entry.createdAt | date: 'd MMM yyyy, h:mm a' }}
                    </p>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    @if (showCancelForm()) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-semibold text-gray-900">Cancelar orden</h3>
            <button
              type="button"
              (click)="closeCancelForm()"
              class="text-gray-400 hover:text-gray-600"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Motivo de la cancelación</label
          >
          <textarea
            [value]="cancelReason()"
            (input)="cancelReason.set($any($event.target).value)"
            class="form-input w-full resize-none"
            rows="3"
            placeholder="Ej. Producto agotado"
          ></textarea>
          @if (cancelError()) {
            <p class="text-sm text-red-600 mt-2">{{ cancelError() }}</p>
          }

          <div class="flex gap-3 mt-5">
            <button
              type="button"
              (click)="closeCancelForm()"
              [disabled]="updating()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Volver
            </button>
            <button
              type="button"
              (click)="onCancelOrder()"
              [disabled]="updating()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              @if (updating()) {
                Cancelando…
              } @else {
                Confirmar cancelación
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export default class SellerOrderDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private sellerOrderService = inject(SellerOrderService);

  order = signal<SellerOrderDetail | null>(null);
  loading = signal(false);
  updating = signal(false);
  actionError = signal<string | null>(null);
  showCancelForm = signal(false);
  cancelReason = signal('');
  cancelError = signal<string | null>(null);

  private orderId!: string;
  private stopWatching: (() => void) | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.orderId = id;
    this.load();
    if (isPlatformBrowser(this.platformId)) {
      this.stopWatching = this.sellerOrderService.watchFulfillments(() => this.load());
    }
  }

  ngOnDestroy(): void {
    this.stopWatching?.();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const order = await this.sellerOrderService.getOrder(this.orderId);
      this.order.set(order);
    } catch {
      this.order.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  nextAction(): { target: FulfillmentStatus; label: string } | null {
    const status = this.order()?.fulfillment.status;
    return status ? (NEXT_ACTION[status] ?? null) : null;
  }

  canCancel(): boolean {
    const status = this.order()?.fulfillment.status;
    return status === 'RECEIVED' || status === 'PROCESSING';
  }

  async onAdvance(target: FulfillmentStatus, label: string): Promise<void> {
    if (!confirm(`¿${label}?`)) return;
    await this.applyTransition(target);
  }

  closeCancelForm(): void {
    this.showCancelForm.set(false);
    this.cancelReason.set('');
    this.cancelError.set(null);
  }

  async onCancelOrder(): Promise<void> {
    const reason = this.cancelReason().trim();
    if (!reason) {
      this.cancelError.set('Debes indicar un motivo para cancelar la orden.');
      return;
    }
    this.cancelError.set(null);
    const ok = await this.applyTransition('CANCELLED', reason);
    if (ok) this.closeCancelForm();
  }

  private async applyTransition(target: FulfillmentStatus, reason?: string): Promise<boolean> {
    this.updating.set(true);
    this.actionError.set(null);
    try {
      await this.sellerOrderService.updateFulfillmentStatus(this.orderId, target, reason);
      await this.load();
      return true;
    } catch (err: unknown) {
      // 409 Conflict: someone else already moved this record — re-fetch so
      // the view reflects the real current status instead of retrying blindly.
      if (err instanceof FulfillmentConflictError) {
        this.actionError.set(err.message);
        await this.load();
      } else {
        const msg =
          err instanceof Error ? err.message : 'No se pudo actualizar el estado de la orden.';
        if (this.showCancelForm()) this.cancelError.set(msg);
        else this.actionError.set(msg);
      }
      return false;
    } finally {
      this.updating.set(false);
    }
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

  actorLabel(actor: FulfillmentHistoryEntry['actorType']): string {
    return ACTOR_LABELS[actor];
  }

  actorClass(actor: FulfillmentHistoryEntry['actorType']): string {
    return ACTOR_CLASSES[actor];
  }
}
