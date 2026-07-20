import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { BullService } from '../../../core/services/bull.service';
import { Product, ProductStatus, ProductType, STRAW_LABELS } from '../../../core/models/product.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';

/** Fila de la lista: una agrupación de pajillas por toro, o un insumo individual. */
interface ListRow {
  kind: 'straw' | 'supply';
  /** bullId para pajillas, productId para insumos. */
  id: string;
  name: string;
  productType: ProductType;
  coverUrl: string | null;
  priceLabel: string;
  stock: number;
  status: ProductStatus;
  subtitle: string;
  /** Pajillas del toro (solo kind 'straw'). */
  straws: Product[];
  /** Motivos de rechazo / cambios a mostrar al vendedor. */
  notes: { label: string; note: string }[];
}

@Component({
  selector: 'app-product-list',
  imports: [DataTableComponent, TableCellDirective, TableEmptyDirective],
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
        [rows]="rows()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="productos"
        (pageChange)="onPageChange($event)"
      >

        <ng-template tableCell="image" let-row>
          @if (row.coverUrl) {
            <img [src]="row.coverUrl" [alt]="row.name" class="w-32 h-20 rounded-lg object-cover" />
          } @else {
            <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          }
        </ng-template>

        <ng-template tableCell="name" let-row>
          <div>
            <span class="font-medium text-gray-900 max-w-[200px] truncate block">{{ row.name }}</span>
            <span class="text-xs text-gray-400">{{ row.subtitle }}</span>
          </div>
        </ng-template>

        <ng-template tableCell="productType" let-row>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + typeClass(row.productType)">
            {{ typeLabel(row.productType) }}
          </span>
        </ng-template>

        <ng-template tableCell="price" let-row>
          <span class="text-gray-900 font-medium">{{ row.priceLabel }}</span>
        </ng-template>

        <ng-template tableCell="stock" let-row>
          <span [class]="row.stock <= 5 ? 'text-orange-600 font-semibold' : 'text-gray-600'">
            {{ row.stock }}
          </span>
        </ng-template>

        <ng-template tableCell="status" let-row>
          <div class="space-y-1.5 max-w-[280px]">
            <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(row.status)">
              {{ statusLabel(row.status) }}
            </span>
            @if (row.notes.length > 0 && (row.status === 'REJECTED' || row.status === 'CHANGES_REQUESTED')) {
              <div [class]="'rounded-lg border px-2.5 py-1.5 text-xs ' + (row.status === 'REJECTED' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-orange-50 border-orange-100 text-orange-700')">
                @for (n of row.notes; track $index) {
                  <p class="leading-snug">
                    @if (n.label) { <span class="font-semibold">{{ n.label }}:</span> }
                    {{ n.note }}
                  </p>
                }
              </div>
            }
          </div>
        </ng-template>

        <ng-template tableCell="actions" let-row>
          <div class="flex items-center gap-2 justify-end">
            @if (row.status === 'DRAFT' || row.status === 'CHANGES_REQUESTED' || row.status === 'REJECTED') {
              <button
                type="button"
                (click)="submitForReview(row)"
                [disabled]="submittingId() === row.id"
                class="px-2.5 py-1 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white disabled:opacity-50 transition-colors"
                title="Enviar para revisión"
              >
                {{ row.status === 'DRAFT' ? 'Enviar' : 'Reenviar' }}
              </button>
            }
            <button
              type="button"
              (click)="editRow(row)"
              class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
              title="Editar"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            @if (row.status === 'DRAFT' || row.status === 'REJECTED') {
              <button
                type="button"
                (click)="confirmDelete.set(row)"
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

    @if (confirmDelete(); as row) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <div class="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">
            {{ row.kind === 'straw' ? 'Eliminar toro y sus pajillas' : 'Eliminar producto' }}
          </h3>
          <p class="text-sm text-gray-500 mb-6">
            @if (row.kind === 'straw') {
              Se eliminará el toro «{{ row.name }}» y sus {{ row.straws.length }} pajilla(s). Esta acción no se puede deshacer.
            } @else {
              Esta acción no se puede deshacer.
            }
          </p>
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
  private bullService = inject(BullService);

  private readonly pageSize = 10;

  readonly columns: TableColumn<ListRow>[] = [
    { key: 'image', label: '', headerClass: 'px-4 py-3 w-14', cellClass: 'px-4 py-3 w-32' },
    { key: 'name', label: 'Nombre', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'productType', label: 'Tipo' },
    { key: 'price', label: 'Precio' },
    { key: 'stock', label: 'Stock' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-32' },
  ];

  allRows = signal<ListRow[]>([]);
  page = signal(1);
  loading = signal(false);
  confirmDelete = signal<ListRow | null>(null);
  deleting = signal(false);
  submittingId = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  rows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.allRows().slice(start, start + this.pageSize);
  });
  total = computed(() => this.allRows().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.allRows().length / this.pageSize)));

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    forkJoin({
      strawListings: this.productService.getMyStrawListings(),
      supplies: this.productService.getMyProducts(1, 100, 'SUPPLIES'),
    }).subscribe({
      next: ({ strawListings, supplies }) => {
        const strawRows: ListRow[] = strawListings.map((listing) => {
          const prices = listing.straws.map((s) => s.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          return {
            kind: 'straw',
            id: listing.bull.id,
            name: listing.bull.name,
            productType: 'STRAW',
            coverUrl: this.coverFromMedia(listing.media),
            priceLabel: min === max ? this.fmtPrice(min) : `${this.fmtPrice(min)} – ${this.fmtPrice(max)}`,
            stock: listing.straws.reduce((sum, s) => sum + s.stockQuantity, 0),
            status: this.repStatus(listing.straws),
            subtitle: `${listing.straws.length} tipo(s) de pajilla`,
            straws: listing.straws,
            notes: listing.straws
              .filter((s) => s.validationNotes && (s.status === 'REJECTED' || s.status === 'CHANGES_REQUESTED'))
              .map((s) => ({ label: STRAW_LABELS[s.strawType!] ?? '', note: s.validationNotes! })),
          };
        });

        const supplyRows: ListRow[] = supplies.data.map((p) => ({
          kind: 'supply',
          id: p.id,
          name: p.name,
          productType: 'SUPPLIES',
          coverUrl: this.coverFromMedia(p.media),
          priceLabel: this.fmtPrice(p.price),
          stock: p.stockQuantity,
          status: p.status,
          subtitle: 'Insumo',
          straws: [],
          notes:
            p.validationNotes && (p.status === 'REJECTED' || p.status === 'CHANGES_REQUESTED')
              ? [{ label: '', note: p.validationNotes }]
              : [],
        }));

        this.allRows.set([...strawRows, ...supplyRows]);
        this.page.set(1);
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
  }

  editRow(row: ListRow): void {
    if (row.kind === 'straw') {
      this.router.navigate(['/seller/products/bull', row.id, 'edit']);
    } else {
      this.router.navigate(['/seller/products', row.id, 'edit']);
    }
  }

  async submitForReview(row: ListRow): Promise<void> {
    this.submittingId.set(row.id);
    this.errorMsg.set(null);
    try {
      const resubmittable: ProductStatus[] = ['DRAFT', 'CHANGES_REQUESTED', 'REJECTED'];
      const targetIds =
        row.kind === 'straw'
          ? row.straws.filter((s) => resubmittable.includes(s.status)).map((s) => s.id)
          : [row.id];
      for (const id of targetIds) {
        await this.productService.submitForValidation(id);
      }
      this.loadData();
    } catch {
      this.errorMsg.set('No se pudo enviar a revisión. Intenta de nuevo.');
    } finally {
      this.submittingId.set(null);
    }
  }

  onDeleteCancel(): void {
    this.confirmDelete.set(null);
  }

  async onDeleteConfirm(): Promise<void> {
    const row = this.confirmDelete();
    if (!row) return;
    this.deleting.set(true);
    try {
      if (row.kind === 'straw') {
        for (const s of row.straws) {
          await this.productService.deleteProduct(s.id);
        }
        await this.bullService.deleteBull(row.id);
      } else {
        await this.productService.deleteProduct(row.id);
      }
      this.confirmDelete.set(null);
      this.allRows.update((list) => list.filter((r) => r !== row));
    } catch {
      this.confirmDelete.set(null);
      this.errorMsg.set('No se pudo eliminar. Intenta de nuevo.');
    } finally {
      this.deleting.set(false);
    }
  }

  typeClass(type: ProductType): string {
    return type === 'STRAW' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700';
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

  private fmtPrice(n: number): string {
    return `$${Math.round(n).toLocaleString('es-CO')}`;
  }

  private coverFromMedia(media: Product['media']): string | null {
    const cover =
      media?.find((m) => m.isCover && m.mediaType === 'image') ??
      media?.find((m) => m.mediaType === 'image');
    return cover ? this.productService.getMediaPublicUrl(cover.storagePath) : null;
  }

  /** Estado representativo de un grupo de pajillas, priorizando el que requiere acción del vendedor. */
  private repStatus(straws: Product[]): ProductStatus {
    const s = straws.map((p) => p.status);
    if (s.some((x) => x === 'REJECTED')) return 'REJECTED';
    if (s.some((x) => x === 'CHANGES_REQUESTED')) return 'CHANGES_REQUESTED';
    if (s.some((x) => x === 'DRAFT')) return 'DRAFT';
    if (s.some((x) => x === 'PENDING_VALIDATION')) return 'PENDING_VALIDATION';
    if (s.some((x) => x === 'OUT_OF_STOCK')) return 'OUT_OF_STOCK';
    if (s.some((x) => x === 'SUSPENDED')) return 'SUSPENDED';
    return 'ACTIVE';
  }
}
