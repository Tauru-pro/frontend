import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SettlementService } from '../../../core/services/settlement.service';
import { Settlement } from '../../../core/models/settlement.model';
import { SellerEarning } from '../../../core/models/seller-earning.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-seller-settlement-detail',
  imports: [RouterLink, PricePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/settlements"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">{{ settlement()?.settlementNumber ?? 'Liquidación' }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">Detalle de las ventas incluidas</p>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else if (settlement(); as s) {

        <div class="bg-white rounded-2xl border border-gray-100 p-6 grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-gray-400">Bruto</p>
            <p class="text-lg font-bold text-gray-900">{{ s.grossAmount | price }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Comisión</p>
            <p class="text-lg font-bold text-gray-900">{{ s.commissionAmount | price }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Neto</p>
            <p class="text-lg font-bold text-primary">{{ s.netAmount | price }}</p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
          <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Ventas incluidas</h2>
          <div class="divide-y divide-gray-50">
            @for (earning of earnings(); track earning.id) {
              <div class="py-3 flex items-center justify-between text-sm">
                <span class="text-gray-600">Orden {{ earning.orderId.slice(0, 8) }} · {{ earning.createdAt | date: 'd MMM y' }}</span>
                <span class="font-semibold text-gray-900">{{ earning.sellerNetAmount | price }}</span>
              </div>
            } @empty {
              <p class="text-sm text-gray-400 py-2">Sin ventas asociadas.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export default class SellerSettlementDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(SettlementService);

  settlement = signal<Settlement | null>(null);
  earnings = signal<SellerEarning[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loading.set(true);
    try {
      const [settlement, items] = await Promise.all([
        firstValueFrom(this.service.getOne(id)),
        firstValueFrom(this.service.getItemsWithEarnings(id)),
      ]);
      this.settlement.set(settlement);
      this.earnings.set(items.map((i) => i.earning));
    } catch {
      this.errorMsg.set('No se pudo cargar la liquidación. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
