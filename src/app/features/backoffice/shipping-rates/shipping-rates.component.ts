import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ShippingRateService } from '../../../core/services/shipping-rate.service';
import { ShippingRate } from '../../../core/models/shipping-rate.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-shipping-rates',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Tarifas de Envío</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona las tarifas por origen y destino</p>
        </div>
        <app-button iconPath="M12 4v16m8-8H4" (clicked)="router.navigate(['/admin/shipping-rates/new'])">
          Nueva Tarifa
        </app-button>
      </div>

      <!-- Generic error -->
      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <!-- Table -->
      <app-data-table
        [columns]="columns"
        [rows]="items()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="tarifas"
        (pageChange)="onPageChange($event)"
      >
        <ng-template tableCell="origin" let-item>
          <span class="text-sm font-medium text-gray-900">{{ item.origin?.name }}</span>
        </ng-template>

        <ng-template tableCell="destination" let-item>
          <span class="text-sm text-gray-600">{{ item.destination?.name }}</span>
        </ng-template>

        <ng-template tableCell="baseRate" let-item>
          <span class="text-sm font-semibold text-primary">$ {{ item.baseRate.toFixed(2) }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <div class="flex items-center gap-2">
            <button
              (click)="router.navigate(['/admin/shipping-rates', item.id, 'edit'])"
              class="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Editar
            </button>
            <button
              (click)="onDelete(item)"
              class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin tarifas de envío</p>
            <p class="text-gray-400 text-sm mb-5">Crea la primera tarifa de envío.</p>
            <app-button (clicked)="router.navigate(['/admin/shipping-rates/new'])">
              Nueva tarifa
            </app-button>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class ShippingRatesComponent implements OnInit {
  protected router = inject(Router);
  private service = inject(ShippingRateService);

  readonly columns: TableColumn<ShippingRate>[] = [
    { key: 'origin', label: 'Origen', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'destination', label: 'Destino' },
    { key: 'baseRate', label: 'Tarifa Base' },
    { key: 'actions', label: '' },
  ];

  items = signal<ShippingRate[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.service.getAll(this.page(), 10).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar las tarifas. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.load();
  }

  async onDelete(item: ShippingRate): Promise<void> {
    if (!confirm(`¿Eliminar la tarifa "${item.origin?.name} → ${item.destination?.name}"?`)) return;
    try {
      await firstValueFrom(this.service.delete(item.id));
      this.load();
    } catch {
      this.errorMsg.set('No se pudo eliminar la tarifa. Intenta de nuevo.');
    }
  }
}
