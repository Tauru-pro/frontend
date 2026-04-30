import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { Product, ProductStatus } from '../../../core/models/product.model';
import {
  DataTableComponent,
} from '../../../shared/components/data-table/data-table.component';
import { TableEmptyDirective, TableHeadersDirective, TableRowDirective } from '../../../shared/directives';

@Component({
  selector: 'app-product-list',
  imports: [DecimalPipe, DataTableComponent, TableHeadersDirective, TableRowDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Mis Productos</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona tu catálogo de productos</p>
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

      <!-- ICA error banner -->
      @if (icaError()) {
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <p class="font-semibold text-amber-800 text-sm">Validación ICA requerida</p>
            <p class="text-amber-600 text-sm mt-1">
              Tu cuenta no tiene una validación ICA activa. Contacta al administrador para
              habilitar la creación, edición y eliminación de productos.
            </p>
          </div>
        </div>
      }

      <!-- Generic error -->
      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <!-- Table card -->
      <app-data-table
        [rows]="products()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="productos"
        (pageChange)="onPageChange($event)"
      >
        <ng-template tableHeaders>
          <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Nombre</th>
          <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Tipo</th>
          <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Raza</th>
          <th class="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Precio</th>
          <th class="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Stock</th>
          <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Estado</th>
          <th class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Creado</th>
          <th class="px-4 py-3"></th>
        </ng-template>

        <ng-template tableRow let-product>
          <td class="px-6 py-4 font-medium text-gray-900 max-w-[200px] truncate">{{ product.name }}</td>
          <td class="px-4 py-4 text-gray-500">{{ product.productType === 'STRAW' ? 'Pajilla' : 'Insumo' }}</td>
          <td class="px-4 py-4 text-gray-500 max-w-[120px] truncate">{{ product.breed }}</td>
          <td class="px-4 py-4 text-gray-900 text-right font-medium">\${{ product.pricePerDose | number:'1.0-2' }}</td>
          <td class="px-4 py-4 text-right" [class]="product.stockQuantity <= 5 ? 'text-orange-600 font-semibold' : 'text-gray-600'">
            {{ product.stockQuantity }}
          </td>
          <td class="px-4 py-4">
            <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(product.status)">
              {{ statusLabel(product.status) }}
            </span>
          </td>
          <td class="px-4 py-4 text-gray-400 text-xs">{{ formatDate(product.createdAt) }}</td>
          <td class="px-4 py-4">
            <div class="flex items-center gap-2 justify-end">
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
            </div>
          </td>
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

    <!-- Delete confirmation modal -->
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

  products = signal<Product[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  confirmDelete = signal<string | null>(null);
  deleting = signal(false);
  icaError = signal(false);
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
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.icaError.set(true);
        } else {
          this.errorMsg.set('No se pudo cargar los productos. Intenta de nuevo.');
        }
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadProducts();
  }

  onDeleteCancel(): void {
    this.confirmDelete.set(null);
  }

  async onDeleteConfirm(): Promise<void> {
    const id = this.confirmDelete();
    if (!id) return;
    this.deleting.set(true);
    this.icaError.set(false);
    this.errorMsg.set(null);
    try {
      await firstValueFrom(this.productService.deleteProduct(id));
      this.confirmDelete.set(null);
      this.products.update(list => list.filter(p => p.id !== id));
      this.total.update(n => n - 1);
    } catch (err) {
      const status = (err as HttpErrorResponse)?.status;
      this.confirmDelete.set(null);
      if (status === 403) {
        this.icaError.set(true);
      } else {
        this.errorMsg.set('No se pudo eliminar el producto. Intenta de nuevo.');
      }
    } finally {
      this.deleting.set(false);
    }
  }

  statusClass(status: ProductStatus): string {
    const map: Record<ProductStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      DRAFT: 'bg-gray-100 text-gray-600',
      PENDING_VALIDATION: 'bg-yellow-50 text-yellow-700',
      SUSPENDED: 'bg-red-50 text-red-500',
      OUT_OF_STOCK: 'bg-orange-50 text-orange-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  statusLabel(status: ProductStatus): string {
    const map: Record<ProductStatus, string> = {
      ACTIVE: 'Activo',
      DRAFT: 'Borrador',
      PENDING_VALIDATION: 'En revisión',
      SUSPENDED: 'Suspendido',
      OUT_OF_STOCK: 'Sin stock',
    };
    return map[status] ?? status;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
