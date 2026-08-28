import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SettlementService } from '../../../core/services/settlement.service';
import { Settlement } from '../../../core/models/settlement.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-seller-settlements-list',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div>
        <h1 class="text-xl font-bold text-gray-900">Liquidaciones</h1>
        <p class="text-sm text-gray-500 mt-0.5">Historial de pagos realizados por la plataforma</p>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="items()"
        [loading]="loading()"
        [page]="1"
        [totalPages]="1"
        [total]="items().length"
        itemLabel="liquidaciones"
      >
        <ng-template tableCell="settlementNumber" let-item>
          <span class="text-sm font-medium text-gray-900">{{ item.settlementNumber }}</span>
        </ng-template>

        <ng-template tableCell="netAmount" let-item>
          <span class="text-sm font-semibold text-primary">{{ item.netAmount | price }}</span>
        </ng-template>

        <ng-template tableCell="status" let-item>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(item.status)">
            {{ statusLabel(item.status) }}
          </span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <button
            (click)="router.navigate(['/seller/settlements', item.id])"
            class="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            Ver detalle
          </button>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <p class="text-gray-800 font-semibold mb-1">Sin liquidaciones todavía</p>
            <p class="text-gray-400 text-sm">Aquí verás el historial cuando la plataforma te liquide tus ventas.</p>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class SellerSettlementsListComponent implements OnInit {
  protected router = inject(Router);
  private service = inject(SettlementService);

  protected columns: TableColumn[] = [
    { key: 'settlementNumber', label: 'Liquidación' },
    { key: 'netAmount', label: 'Neto' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: '' },
  ];

  items = signal<Settlement[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await firstValueFrom(this.service.getAll()));
    } catch {
      this.errorMsg.set('No se pudieron cargar tus liquidaciones. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-500',
      PENDING: 'bg-yellow-50 text-yellow-700',
      PROCESSING: 'bg-blue-50 text-blue-700',
      PAID: 'bg-green-50 text-green-700',
      CANCELLED: 'bg-gray-100 text-gray-500',
      FAILED: 'bg-red-50 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Borrador',
      PENDING: 'Pendiente',
      PROCESSING: 'Procesando',
      PAID: 'Pagada',
      CANCELLED: 'Cancelada',
      FAILED: 'Fallida',
    };
    return map[status] ?? status;
  }
}
