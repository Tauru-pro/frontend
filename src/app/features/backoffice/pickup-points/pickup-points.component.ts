import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PickupPointService } from '../../../core/services/pickup-point.service';
import { PickupPoint } from '../../../core/models/pickup-point.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-pickup-points',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Puntos de Recogida</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona los puntos de retiro de productos</p>
        </div>
        <app-button iconPath="M12 4v16m8-8H4" (clicked)="router.navigate(['/admin/pickup-points/new'])">
          Nuevo Punto
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
        itemLabel="puntos"
        (pageChange)="onPageChange($event)"
      >
        <ng-template tableCell="name" let-item>
          <span class="text-sm font-medium text-gray-900">{{ item.name }}</span>
        </ng-template>

        <ng-template tableCell="location" let-item>
          <span class="text-sm text-gray-600">{{ item.city?.name }}, {{ item.state?.name }}</span>
        </ng-template>

        <ng-template tableCell="address" let-item>
          <span class="text-sm text-gray-500 truncate max-w-[200px] block">{{ item.address }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <div class="flex items-center gap-2">
            <button
              (click)="router.navigate(['/admin/pickup-points', item.id, 'edit'])"
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin puntos de recogida</p>
            <p class="text-gray-400 text-sm mb-5">Crea el primer punto de retiro.</p>
            <app-button (clicked)="router.navigate(['/admin/pickup-points/new'])">
              Nuevo punto
            </app-button>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class PickupPointsComponent implements OnInit {
  protected router = inject(Router);
  private service = inject(PickupPointService);

  readonly columns: TableColumn<PickupPoint>[] = [
    { key: 'name',     label: 'Nombre',     headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'location', label: 'Ubicación' },
    { key: 'address',  label: 'Dirección' },
    { key: 'actions',  label: '' },
  ];

  items = signal<PickupPoint[]>([]);
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
        this.errorMsg.set('No se pudo cargar los puntos de recogida. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.load();
  }

  async onDelete(item: PickupPoint): Promise<void> {
    if (!confirm(`¿Eliminar el punto "${item.name}"?`)) return;
    try {
      await firstValueFrom(this.service.delete(item.id));
      this.load();
    } catch {
      this.errorMsg.set('No se pudo eliminar el punto. Intenta de nuevo.');
    }
  }
}
