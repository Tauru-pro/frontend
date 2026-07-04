import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { Product, ProductStatus, ProductType } from '../../../core/models/product.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';

@Component({
  selector: 'app-product-list',
  imports: [DecimalPipe, DataTableComponent, TableCellDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Mis Productos</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona tu catálogo de pajillas e insumos</p>
        </div>
        <button
          type="button"
          (click)="router.navigate(['/seller/products/new'])"
          class="flex items-center gap-2 btn-primary px-4 py-2.5 text-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo Producto
        </button>
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
        itemLabel="productos"
        (pageChange)="onPageChange($event)"
      >

        <ng-template tableCell="image" let-product>
          @if (getCoverUrl(product); as url) {
            <img [src]="url" [alt]="product.name" class="w-32 h-20 rounded-lg object-cover" />
          } @else {
            <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          }
        </ng-template>

        <ng-template tableCell="name" let-product>
          <div>
            <span class="font-medium text-gray-900 max-w-[200px] truncate block">{{ product.name }}</span>
            @if (product.bull) {
              <span class="text-xs text-gray-400">Toro: {{ product.bull.name }}</span>
            }
          </div>
        </ng-template>

        <ng-template tableCell="productType" let-product>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + typeClass(product.productType)">
            {{ typeLabel(product.productType) }}
          </span>
        </ng-template>

        <ng-template tableCell="price" let-product>
          <span class="text-gray-900 font-medium">\${{ product.price | number:'1.0-0' }}</span>
        </ng-template>

        <ng-template tableCell="stockQuantity" let-product>
          <span [class]="product.stockQuantity <= 5 ? 'text-orange-600 font-semibold' : 'text-gray-600'">
            {{ product.stockQuantity }}
          </span>
        </ng-template>

        <ng-template tableCell="status" let-product>
          <div class="space-y-1">
            <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(product.status)">
              {{ statusLabel(product.status) }}
            </span>
            @if (product.validationNotes && (product.status === 'REJECTED' || product.status === 'CHANGES_REQUESTED')) {
              <p class="text-xs text-gray-500 max-w-[180px] truncate" [title]="product.validationNotes">
                {{ product.validationNotes }}
              </p>
            }
          </div>
        </ng-template>

        <ng-template tableCell="createdAt" let-product>
          <span class="text-gray-400 text-xs">{{ formatDate(product.createdAt) }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-product>
          <div class="flex items-center gap-2 justify-end">
            @if (product.status === 'DRAFT' || product.status === 'CHANGES_REQUESTED') {
              <button
                type="button"
                (click)="submitForReview(product.id)"
                class="px-2.5 py-1 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                title="Enviar para revisión"
              >
                Enviar
              </button>
            }
            <button
              type="button"
              (click)="router.navigate(['/seller/products', product.id, 'edit'])"
              class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
              title="Editar"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            @if (product.status === 'DRAFT' || product.status === 'REJECTED') {
              <button
                type="button"
                (click)="confirmDelete.set(product.id)"
                class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Eliminar"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            }
          </div>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin productos aún</p>
            <p class="text-gray-400 text-sm mb-5">Crea tu primer producto para comenzar a vender.</p>
            <button
              type="button"
              (click)="router.navigate(['/seller/products/new'])"
              class="btn-primary px-5 py-2.5 text-sm"
            >
              Crear producto
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
          <h3 class="font-semibold text-gray-900 mb-1">Eliminar producto</h3>
          <p class="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
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
export default class ProductListComponent implements OnInit {
  protected router = inject(Router);
  private productService = inject(ProductService);

  readonly columns: TableColumn<Product>[] = [
    { key: 'image', label: '', headerClass: 'px-4 py-3 w-14', cellClass: 'px-4 py-3 w-32' },
    { key: 'name', label: 'Nombre', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'productType', label: 'Tipo' },
    { key: 'price', label: 'Precio' },
    { key: 'stockQuantity', label: 'Stock' },
    { key: 'status', label: 'Estado' },
    { key: 'createdAt', label: 'Creado' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-32' },
  ];

  products = signal<Product[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  confirmDelete = signal<string | null>(null);
  deleting = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.productService.getMyProducts(this.page(), 10).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudieron cargar los productos. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadProducts();
  }

  async submitForReview(id: string): Promise<void> {
    try {
      await this.productService.submitForValidation(id);
      this.products.update(list =>
        list.map(p => p.id === id ? { ...p, status: 'PENDING_VALIDATION' as ProductStatus } : p),
      );
    } catch {
      this.errorMsg.set('No se pudo enviar a revisión. Intenta de nuevo.');
    }
  }

  onDeleteCancel(): void {
    this.confirmDelete.set(null);
  }

  async onDeleteConfirm(): Promise<void> {
    const id = this.confirmDelete();
    if (!id) return;
    this.deleting.set(true);
    try {
      await this.productService.deleteProduct(id);
      this.confirmDelete.set(null);
      this.products.update(list => list.filter(p => p.id !== id));
      this.total.update(n => n - 1);
    } catch {
      this.confirmDelete.set(null);
      this.errorMsg.set('No se pudo eliminar el producto. Intenta de nuevo.');
    } finally {
      this.deleting.set(false);
    }
  }

  typeClass(type: ProductType): string {
    return type === 'STRAW'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-purple-50 text-purple-700';
  }

  typeLabel(type: ProductType): string {
    return type === 'STRAW' ? 'Pajilla' : 'Insumo';
  }

  statusClass(status: ProductStatus): string {
    const map: Record<ProductStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      DRAFT: 'bg-gray-100 text-gray-600',
      SUSPENDED: 'bg-red-50 text-red-500',
      OUT_OF_STOCK: 'bg-orange-50 text-orange-600',
      PENDING_VALIDATION: 'bg-yellow-50 text-yellow-700',
      REJECTED: 'bg-red-50 text-red-700',
      CHANGES_REQUESTED: 'bg-orange-50 text-orange-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  statusLabel(status: ProductStatus): string {
    const map: Record<ProductStatus, string> = {
      ACTIVE: 'Activo',
      DRAFT: 'Borrador',
      SUSPENDED: 'Suspendido',
      OUT_OF_STOCK: 'Sin stock',
      PENDING_VALIDATION: 'En revisión',
      REJECTED: 'Rechazado',
      CHANGES_REQUESTED: 'Con observaciones',
    };
    return map[status] ?? status;
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
