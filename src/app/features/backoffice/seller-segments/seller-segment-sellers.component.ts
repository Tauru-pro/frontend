import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { SellerInSegment, SellerSegment } from '../../../core/models/seller-segment.model';

@Component({
  selector: 'app-seller-segment-sellers',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/seller-segments"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            Vendedores {{ segment() ? '— ' + segment()!.name : '' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">Vendedores asignados a este segmento</p>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else if (sellers().length === 0) {
        <div class="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center text-center px-6">
          <p class="text-gray-800 font-semibold mb-1">Sin vendedores en este segmento</p>
          <p class="text-gray-400 text-sm">Asigna este segmento a un vendedor desde su revisión.</p>
        </div>
      } @else {
        <div class="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          @for (s of sellers(); track s.id) {
            <div class="px-6 py-4 flex items-center justify-between">
              <span class="text-sm font-medium text-gray-900">{{ s.businessName }}</span>
              <span class="text-xs text-gray-400">{{ s.status }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class SellerSegmentSellersComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(SellerSegmentService);

  segment = signal<SellerSegment | null>(null);
  sellers = signal<SellerInSegment[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loading.set(true);
    try {
      const [segment, sellers] = await Promise.all([
        firstValueFrom(this.service.getOne(id)),
        firstValueFrom(this.service.getSellersInSegment(id)),
      ]);
      this.segment.set(segment);
      this.sellers.set(sellers);
    } catch {
      this.errorMsg.set('No se pudo cargar la información del segmento. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
