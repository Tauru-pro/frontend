import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { SellerEarningService } from '../../../core/services/seller-earning.service';
import { SettlementService } from '../../../core/services/settlement.service';
import { SellerProfile } from '../../../core/models/user.model';
import { SellerEarning } from '../../../core/models/seller-earning.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-settlement-form',
  imports: [RouterLink, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/settlements"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">Nueva liquidación</h1>
          <p class="text-sm text-gray-500 mt-0.5">Selecciona un vendedor y las ventas disponibles a liquidar</p>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Vendedor</h2>
        <select
          (change)="onSellerChange($any($event.target).value)"
          class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
        >
          <option value="" [selected]="!selectedSellerId()">Selecciona un vendedor</option>
          @for (s of sellers(); track s.id) {
            <option [value]="s.id" [selected]="s.id === selectedSellerId()">{{ s.bussinesName }}</option>
          }
        </select>
      </div>

      @if (selectedSellerId()) {
        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Ventas disponibles</h2>

          @if (loadingEarnings()) {
            <div class="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
          } @else if (earnings().length === 0) {
            <p class="text-sm text-gray-400">Este vendedor no tiene ventas disponibles para liquidar.</p>
          } @else {
            <div class="divide-y divide-gray-50">
              @for (e of earnings(); track e.id) {
                <label class="py-3 flex items-center justify-between gap-4 cursor-pointer">
                  <div class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      [checked]="selectedEarningIds().has(e.id)"
                      (change)="toggleEarning(e.id)"
                      class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                    />
                    <span class="text-sm text-gray-600">Orden {{ e.orderId.slice(0, 8) }}</span>
                  </div>
                  <span class="text-sm font-semibold text-gray-900">{{ e.sellerNetAmount | price }}</span>
                </label>
              }
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-gray-100">
              <span class="text-sm font-medium text-gray-700">Total a liquidar</span>
              <span class="text-lg font-bold text-primary">{{ selectedTotal() | price }}</span>
            </div>
          }
        </div>
      }

      <div class="flex gap-3 justify-end pb-6">
        <a
          routerLink="/admin/settlements"
          class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </a>
        <button
          type="button"
          (click)="onCreate()"
          [disabled]="creating() || selectedEarningIds().size === 0"
          class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60"
        >
          @if (creating()) { Creando... } @else { Crear liquidación }
        </button>
      </div>
    </div>
  `,
})
export default class SettlementFormComponent {
  private router = inject(Router);
  private userService = inject(UserService);
  private earningService = inject(SellerEarningService);
  private settlementService = inject(SettlementService);

  sellers = signal<SellerProfile[]>([]);
  selectedSellerId = signal<string>('');
  earnings = signal<SellerEarning[]>([]);
  selectedEarningIds = signal<Set<string>>(new Set());
  loadingEarnings = signal(false);
  creating = signal(false);
  errorMsg = signal<string | null>(null);

  constructor() {
    this.loadSellers();
  }

  private async loadSellers(): Promise<void> {
    try {
      const res = await this.userService.getSellers(1, 100);
      this.sellers.set(res.data);
    } catch {
      this.errorMsg.set('No se pudieron cargar los vendedores. Intenta de nuevo.');
    }
  }

  async onSellerChange(sellerId: string): Promise<void> {
    this.selectedSellerId.set(sellerId);
    this.selectedEarningIds.set(new Set());
    this.earnings.set([]);
    if (!sellerId) return;

    this.loadingEarnings.set(true);
    this.errorMsg.set(null);
    try {
      this.earnings.set(await firstValueFrom(this.earningService.getAvailableForSeller(sellerId)));
    } catch {
      this.errorMsg.set('No se pudieron cargar las ventas disponibles. Intenta de nuevo.');
    } finally {
      this.loadingEarnings.set(false);
    }
  }

  toggleEarning(id: string): void {
    const next = new Set(this.selectedEarningIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedEarningIds.set(next);
  }

  selectedTotal(): number {
    const ids = this.selectedEarningIds();
    return this.earnings()
      .filter((e) => ids.has(e.id))
      .reduce((sum, e) => sum + e.sellerNetAmount, 0);
  }

  async onCreate(): Promise<void> {
    const sellerId = this.selectedSellerId();
    const earningIds = Array.from(this.selectedEarningIds());
    if (!sellerId || earningIds.length === 0) return;

    this.creating.set(true);
    this.errorMsg.set(null);
    try {
      const settlementId = await this.settlementService.create(sellerId, earningIds);
      this.router.navigate(['/admin/settlements', settlementId]);
    } catch {
      this.errorMsg.set(
        'No se pudo crear la liquidación — es posible que alguna venta seleccionada ya no esté disponible. Actualiza la lista e intenta de nuevo.',
      );
      await this.onSellerChange(sellerId);
    } finally {
      this.creating.set(false);
    }
  }
}
