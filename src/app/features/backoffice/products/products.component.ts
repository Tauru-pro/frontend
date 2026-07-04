import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ProductService } from '../../../core/services/product.service';
import { Product, ProductStatus, ProductType } from '../../../core/models/product.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';
import { DecimalPipe } from '@angular/common';
import { FormField, form, required } from '@angular/forms/signals';

@Component({
  selector: 'app-products-validation',
  imports: [DecimalPipe, DataTableComponent, TableCellDirective, TableEmptyDirective, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div>
        <h1 class="text-xl font-bold text-gray-900">Validación de Productos</h1>
        <p class="text-sm text-gray-500 mt-0.5">Revisa y aprueba los productos enviados por los vendedores</p>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="products()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="productos pendientes"
        (pageChange)="onPageChange($event)"
      >

        <ng-template tableCell="product" let-p>
          <div class="flex items-center gap-3">
            @if (getCoverUrl(p); as url) {
              <img [src]="url" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" [alt]="p.name"/>
            } @else {
              <div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
            }
            <div class="min-w-0">
              <p class="font-medium text-gray-900 truncate max-w-[200px]">{{ p.name }}</p>
              @if (p.bull) {
                <p class="text-xs text-gray-400">Toro: {{ p.bull.name }}</p>
              }
            </div>
          </div>
        </ng-template>

        <ng-template tableCell="type" let-p>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + typeClass(p.productType)">
            {{ typeLabel(p.productType) }}
          </span>
        </ng-template>

        <ng-template tableCell="price" let-p>
          <span class="text-gray-900 font-medium">\${{ p.price | number:'1.0-0' }}</span>
        </ng-template>

        <ng-template tableCell="submittedAt" let-p>
          <span class="text-gray-400 text-xs">{{ formatDate(p.updatedAt) }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-p>
          <div class="flex items-center gap-2 justify-end">
            <button
              type="button"
              (click)="approve(p.id)"
              [disabled]="processingId() === p.id"
              class="px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Aprobar
            </button>
            <button
              type="button"
              (click)="openNotesModal(p.id, 'CHANGES_REQUESTED')"
              [disabled]="processingId() === p.id"
              class="px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Cambios
            </button>
            <button
              type="button"
              (click)="openNotesModal(p.id, 'REJECTED')"
              [disabled]="processingId() === p.id"
              class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              Rechazar
            </button>
          </div>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Todo al día</p>
            <p class="text-gray-400 text-sm">No hay productos pendientes de revisión.</p>
          </div>
        </ng-template>
      </app-data-table>
    </div>

    <!-- Notes modal (reject / request changes) -->
    @if (notesModal()) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
          <div class="flex items-center gap-3">
            <div [class]="'w-10 h-10 rounded-xl flex items-center justify-center ' + (notesModal()!.action === 'REJECTED' ? 'bg-red-50' : 'bg-orange-50')">
              <svg [class]="'w-5 h-5 ' + (notesModal()!.action === 'REJECTED' ? 'text-red-500' : 'text-orange-500')" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">
              {{ notesModal()!.action === 'REJECTED' ? 'Rechazar producto' : 'Solicitar cambios' }}
            </h3>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              {{ notesModal()!.action === 'REJECTED' ? 'Motivo del rechazo' : 'Cambios solicitados' }}
              <span class="text-red-400">*</span>
            </label>
            <textarea
              [formField]="notesForm.notes"
              rows="4"
              placeholder="Describe el motivo..."
              class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
            ></textarea>
            @if (notesForm.notes().touched() && notesForm.notes().errors().length) {
              <p class="text-red-400 text-xs mt-1.5">{{ notesForm.notes().errors()[0].message }}</p>
            }
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              (click)="notesModal.set(null)"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="submitModal()"
              [disabled]="processingId() !== null"
              [class]="'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-60 transition-colors ' +
                (notesModal()!.action === 'REJECTED' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600')"
            >
              @if (processingId() !== null) { Guardando... }
              @else { {{ notesModal()!.action === 'REJECTED' ? 'Rechazar' : 'Solicitar cambios' }} }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export default class ProductsValidationComponent implements OnInit {
  private productService = inject(ProductService);

  readonly columns: TableColumn<Product>[] = [
    { key: 'product', label: 'Producto', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'type', label: 'Tipo' },
    { key: 'price', label: 'Precio' },
    { key: 'submittedAt', label: 'Enviado' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-52' },
  ];

  products = signal<Product[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  processingId = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  notesModal = signal<{ productId: string; action: 'REJECTED' | 'CHANGES_REQUESTED' } | null>(null);

  notesModel = signal({ notes: '' });
  notesForm = form(this.notesModel, (s) => {
    required(s.notes, { message: 'El motivo es requerido' });
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.productService.getAllPendingValidation(this.page()).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar los productos pendientes. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadProducts();
  }

  async approve(id: string): Promise<void> {
    this.processingId.set(id);
    this.errorMsg.set(null);
    try {
      await this.productService.approveProduct(id);
      this.products.update(list => list.filter(p => p.id !== id));
      this.total.update(n => n - 1);
    } catch {
      this.errorMsg.set('No se pudo aprobar el producto. Intenta de nuevo.');
    } finally {
      this.processingId.set(null);
    }
  }

  openNotesModal(productId: string, action: 'REJECTED' | 'CHANGES_REQUESTED'): void {
    this.notesModel.set({ notes: '' });
    this.notesModal.set({ productId, action });
  }

  async submitModal(): Promise<void> {
    const modal = this.notesModal();
    if (!modal) return;
    const notes = this.notesModel().notes.trim();
    if (!notes) return;

    this.processingId.set(modal.productId);
    try {
      if (modal.action === 'REJECTED') {
        await this.productService.rejectProduct(modal.productId, notes);
      } else {
        await this.productService.requestChanges(modal.productId, notes);
      }
      this.notesModal.set(null);
      this.products.update(list => list.filter(p => p.id !== modal.productId));
      this.total.update(n => n - 1);
    } catch {
      this.errorMsg.set('No se pudo procesar la acción. Intenta de nuevo.');
    } finally {
      this.processingId.set(null);
    }
  }

  typeClass(type: ProductType): string {
    return type === 'STRAW' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700';
  }

  typeLabel(type: ProductType): string {
    return type === 'STRAW' ? 'Pajilla' : 'Insumo';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  getCoverUrl(product: Product): string | null {
    const cover = product.media?.find(m => m.isCover && m.mediaType === 'image')
      ?? product.media?.find(m => m.mediaType === 'image');
    return cover ? this.productService.getMediaPublicUrl(cover.storagePath) : null;
  }
}
