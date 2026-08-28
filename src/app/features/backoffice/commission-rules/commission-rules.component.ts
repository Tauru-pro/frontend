import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { CommissionRuleService } from '../../../core/services/commission-rule.service';
import { SellerSegment } from '../../../core/models/seller-segment.model';

interface SegmentRateRow {
  segment: SellerSegment;
  currentRate: number | null;
}

@Component({
  selector: 'app-commission-rules',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div>
        <h1 class="text-xl font-bold text-gray-900">Comisiones por segmento</h1>
        <p class="text-sm text-gray-500 mt-0.5">Consulta y programa cambios en la comisión de cada segmento</p>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else {
        <div class="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          @for (row of rows(); track row.segment.id) {
            <div class="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ row.segment.name }}</p>
                <p class="text-xs text-gray-400">{{ row.segment.code }}</p>
              </div>
              <div class="flex items-center gap-4">
                @if (row.currentRate !== null) {
                  <span class="text-lg font-bold text-primary">{{ row.currentRate }}%</span>
                } @else {
                  <span class="text-sm text-gray-400">Sin comisión configurada</span>
                }
                <button
                  (click)="router.navigate(['/admin/commission-rules', row.segment.id, 'new'])"
                  class="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Programar cambio
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class CommissionRulesComponent implements OnInit {
  protected router = inject(Router);
  private segmentService = inject(SellerSegmentService);
  private commissionService = inject(CommissionRuleService);

  rows = signal<SegmentRateRow[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const segments = await firstValueFrom(this.segmentService.getAll());
      const rows = await Promise.all(
        segments.map(async (segment) => ({
          segment,
          currentRate: await this.commissionService.getCurrentRate(segment.id),
        })),
      );
      this.rows.set(rows);
    } catch {
      this.errorMsg.set('No se pudieron cargar las comisiones. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
