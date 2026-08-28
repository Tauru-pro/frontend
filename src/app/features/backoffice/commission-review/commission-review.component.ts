import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SellerEarningService } from '../../../core/services/seller-earning.service';
import { SellerEarning } from '../../../core/models/seller-earning.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-commission-review',
  imports: [PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div>
        <h1 class="text-xl font-bold text-gray-900">Comisiones pendientes de revisión</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Ventas cuyo vendedor no tenía segmento o comisión configurada en el momento del pago
        </p>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else if (items().length === 0) {
        <div class="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center text-center px-6">
          <p class="text-gray-800 font-semibold mb-1">Sin comisiones pendientes</p>
          <p class="text-gray-400 text-sm">Todas las ventas tienen una comisión resuelta.</p>
        </div>
      } @else {
        <div class="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          @for (e of items(); track e.id) {
            <div class="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-gray-900">Orden {{ e.orderId.slice(0, 8) }}</p>
                <p class="text-xs text-gray-400">Bruto: {{ e.grossAmount | price }}</p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="%"
                  [value]="rateInputs()[e.id]"
                  (input)="setRateInput(e.id, $any($event.target).value)"
                  class="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                />
                <button
                  (click)="resolve(e.id)"
                  [disabled]="resolving() === e.id || !rateInputs()[e.id]"
                  class="btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  @if (resolving() === e.id) { Guardando... } @else { Resolver }
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class CommissionReviewComponent implements OnInit {
  private service = inject(SellerEarningService);

  items = signal<SellerEarning[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);
  resolving = signal<string | null>(null);
  rateInputs = signal<Record<string, string>>({});

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      this.items.set(await firstValueFrom(this.service.getFlaggedForReview()));
    } catch {
      this.errorMsg.set('No se pudieron cargar las comisiones pendientes. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  setRateInput(id: string, value: string): void {
    this.rateInputs.set({ ...this.rateInputs(), [id]: value });
  }

  async resolve(id: string): Promise<void> {
    const rate = Number(this.rateInputs()[id]);
    if (!Number.isFinite(rate)) return;

    this.resolving.set(id);
    this.errorMsg.set(null);
    try {
      await this.service.resolveCommission(id, rate);
      await this.load();
    } catch {
      this.errorMsg.set('No se pudo resolver la comisión. Intenta de nuevo.');
    } finally {
      this.resolving.set(null);
    }
  }
}
