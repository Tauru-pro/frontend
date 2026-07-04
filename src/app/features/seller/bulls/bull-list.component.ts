import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BullService } from '../../../core/services/bull.service';
import { Bull, BullStatus } from '../../../core/models/bull.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';

@Component({
  selector: 'app-bull-list',
  imports: [DataTableComponent, TableCellDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Mis Toros</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona tu catálogo de toros genéticos</p>
        </div>
        <button
          type="button"
          (click)="router.navigate(['/seller/bulls/new'])"
          class="flex items-center gap-2 btn-primary px-4 py-2.5 text-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo Toro
        </button>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="bulls()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="toros"
        (pageChange)="onPageChange($event)"
      >

        <ng-template tableCell="image" let-bull>
          @if (getCoverUrl(bull); as url) {
            <img [src]="url" [alt]="bull.name" class="w-32 h-20 rounded-lg object-cover" />
          } @else {
            <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          }
        </ng-template>

        <ng-template tableCell="name" let-bull>
          <span class="font-medium text-gray-900 max-w-[200px] truncate block">{{ bull.name }}</span>
        </ng-template>

        <ng-template tableCell="breed" let-bull>
          <span class="text-gray-500 max-w-[120px] truncate block">{{ bull.breed?.name ?? '—' }}</span>
        </ng-template>

        <ng-template tableCell="origin" let-bull>
          <span class="text-gray-500">{{ bull.origin === 'NATIONAL' ? 'Nacional' : 'Importado' }}</span>
        </ng-template>

        <ng-template tableCell="status" let-bull>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(bull.status)">
            {{ statusLabel(bull.status) }}
          </span>
        </ng-template>

        <ng-template tableCell="createdAt" let-bull>
          <span class="text-gray-400 text-xs">{{ formatDate(bull.createdAt) }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-bull>
          <div class="flex items-center gap-2 justify-end">
            <button
              type="button"
              (click)="router.navigate(['/seller/bulls', bull.id, 'edit'])"
              class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
              title="Editar"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button
              type="button"
              (click)="confirmDelete.set(bull.id)"
              class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Eliminar"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin toros aún</p>
            <p class="text-gray-400 text-sm mb-5">Crea tu primer toro para comenzar a ofrecer pajillas.</p>
            <button
              type="button"
              (click)="router.navigate(['/seller/bulls/new'])"
              class="btn-primary px-5 py-2.5 text-sm"
            >
              Crear toro
            </button>
          </div>
        </ng-template>
      </app-data-table>
    </div>

    @if (confirmDelete()) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <div class="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Eliminar toro</h3>
          <p class="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer. Se eliminarán también sus archivos.</p>
          <div class="flex gap-3">
            <button
              type="button"
              (click)="onDeleteCancel()"
              [disabled]="deleting()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="onDeleteConfirm()"
              [disabled]="deleting()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
            >
              @if (deleting()) { Eliminando... } @else { Eliminar }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export default class BullListComponent implements OnInit {
  protected router = inject(Router);
  private bullService = inject(BullService);

  readonly columns: TableColumn<Bull>[] = [
    { key: 'image', label: '', headerClass: 'px-4 py-3 w-14', cellClass: 'px-4 py-3 w-32' },
    { key: 'name', label: 'Nombre', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'breed', label: 'Raza' },
    { key: 'origin', label: 'Origen' },
    { key: 'status', label: 'Estado' },
    { key: 'createdAt', label: 'Creado' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-20' },
  ];

  bulls = signal<Bull[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  confirmDelete = signal<string | null>(null);
  deleting = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.loadBulls();
  }

  loadBulls(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.bullService.getMyBulls(this.page(), 10).subscribe({
      next: (res) => {
        this.bulls.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar los toros. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadBulls();
  }

  onDeleteCancel(): void {
    this.confirmDelete.set(null);
  }

  async onDeleteConfirm(): Promise<void> {
    const id = this.confirmDelete();
    if (!id) return;
    this.deleting.set(true);
    this.errorMsg.set(null);
    try {
      await this.bullService.deleteBull(id);
      this.confirmDelete.set(null);
      this.bulls.update(list => list.filter(b => b.id !== id));
      this.total.update(n => n - 1);
    } catch {
      this.confirmDelete.set(null);
      this.errorMsg.set('No se pudo eliminar el toro. Intenta de nuevo.');
    } finally {
      this.deleting.set(false);
    }
  }

  statusClass(status: BullStatus): string {
    const map: Record<BullStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      DRAFT: 'bg-gray-100 text-gray-600',
      SUSPENDED: 'bg-red-50 text-red-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  statusLabel(status: BullStatus): string {
    const map: Record<BullStatus, string> = {
      ACTIVE: 'Activo',
      DRAFT: 'Borrador',
      SUSPENDED: 'Suspendido',
    };
    return map[status] ?? status;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  getCoverUrl(bull: Bull): string | null {
    const cover = bull.media?.find(m => m.isCover && m.mediaType === 'image')
      ?? bull.media?.find(m => m.mediaType === 'image');
    return cover ? this.bullService.getMediaPublicUrl(cover.storagePath) : null;
  }
}
