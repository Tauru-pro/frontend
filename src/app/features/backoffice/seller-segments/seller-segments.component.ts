import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { SellerSegment } from '../../../core/models/seller-segment.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-seller-segments',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Segmentos de vendedor</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona los segmentos comerciales y su comisión</p>
        </div>
        <app-button iconPath="M12 4v16m8-8H4" (clicked)="router.navigate(['/admin/seller-segments/new'])">
          Nuevo segmento
        </app-button>
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
        itemLabel="segmentos"
      >
        <ng-template tableCell="name" let-item>
          <div>
            <span class="text-sm font-medium text-gray-900">{{ item.name }}</span>
            <p class="text-xs text-gray-400">{{ item.code }}</p>
          </div>
        </ng-template>

        <ng-template tableCell="description" let-item>
          <span class="text-sm text-gray-600">{{ item.description || '—' }}</span>
        </ng-template>

        <ng-template tableCell="active" let-item>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            [class.bg-green-50]="item.active"
            [class.text-green-700]="item.active"
            [class.bg-gray-100]="!item.active"
            [class.text-gray-500]="!item.active"
          >
            {{ item.active ? 'Activo' : 'Inactivo' }}
          </span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <div class="flex items-center gap-2">
            <button
              (click)="router.navigate(['/admin/seller-segments', item.id, 'edit'])"
              class="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Editar
            </button>
            <button
              (click)="router.navigate(['/admin/seller-segments', item.id, 'sellers'])"
              class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Vendedores
            </button>
            <button
              (click)="toggleActive(item)"
              [disabled]="toggling() === item.id"
              class="px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-60"
              [class.text-red-600]="item.active"
              [class.border-red-200]="item.active"
              [class.hover:bg-red-50]="item.active"
              [class.text-green-700]="!item.active"
              [class.border-green-200]="!item.active"
              [class.hover:bg-green-50]="!item.active"
            >
              {{ item.active ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <p class="text-gray-800 font-semibold mb-1">Sin segmentos registrados</p>
            <p class="text-gray-400 text-sm mb-5">Crea el primer segmento comercial.</p>
            <app-button (clicked)="router.navigate(['/admin/seller-segments/new'])">
              Nuevo segmento
            </app-button>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class SellerSegmentsComponent implements OnInit {
  protected router = inject(Router);
  private service = inject(SellerSegmentService);

  protected columns: TableColumn[] = [
    { key: 'name', label: 'Segmento' },
    { key: 'description', label: 'Descripción' },
    { key: 'active', label: 'Estado' },
    { key: 'actions', label: '' },
  ];

  items = signal<SellerSegment[]>([]);
  loading = signal(true);
  errorMsg = signal<string | null>(null);
  toggling = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      this.items.set(await firstValueFrom(this.service.getAll()));
    } catch {
      this.errorMsg.set('No se pudieron cargar los segmentos. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleActive(item: SellerSegment): Promise<void> {
    this.toggling.set(item.id);
    this.errorMsg.set(null);
    try {
      await this.service.update(item.id, { active: !item.active });
      await this.load();
    } catch {
      this.errorMsg.set('No se pudo actualizar el segmento. Intenta de nuevo.');
    } finally {
      this.toggling.set(null);
    }
  }
}
