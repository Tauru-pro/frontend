import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';

@Component({
  selector: 'app-inventory-overview',
  imports: [DataTableComponent, TableCellDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div>
        <h1 class="text-xl font-bold text-gray-900">Inventario Global</h1>
        <p class="text-sm text-gray-500 mt-0.5">Vista de stock de todos los vendedores</p>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <!-- Filters -->
      <div class="flex flex-wrap gap-3">
        <input
          type="text"
          [value]="tenantFilter()"
          (input)="tenantFilter.set($any($event.target).value)"
          placeholder="Filtrar por tenant…"
          class="form-input text-sm w-56"
        />
        <input
          type="text"
          [value]="branchFilter()"
          (input)="branchFilter.set($any($event.target).value)"
          placeholder="Filtrar por sucursal…"
          class="form-input text-sm w-56"
        />
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="filteredItems()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="filteredItems().length"
        itemLabel="ítems"
        (pageChange)="onPageChange($event)"
      >

        <ng-template tableCell="product" let-item>
          <span class="font-medium text-gray-900">{{ item.product?.name ?? '—' }}</span>
        </ng-template>

        <ng-template tableCell="branch" let-item>
          <span class="text-gray-600 text-sm">{{ item.branch?.name ?? '—' }}</span>
        </ng-template>

        <ng-template tableCell="stock" let-item>
          <div class="flex items-center gap-2">
            <span [class]="item.currentStock <= item.minStockQuantity ? 'font-semibold text-red-600' : 'font-semibold text-gray-900'">
              {{ item.currentStock }}
            </span>
            @if (item.currentStock <= item.minStockQuantity) {
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                Stock bajo
              </span>
            }
          </div>
        </ng-template>

        <ng-template tableCell="minStock" let-item>
          <span class="text-gray-500 text-sm">{{ item.minStockQuantity }}</span>
        </ng-template>

        <ng-template tableCell="tenant" let-item>
          <span class="text-xs font-mono text-gray-400 truncate max-w-[100px] block" [title]="item.tenantId">
            {{ item.tenantId.slice(0, 8) }}…
          </span>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-14 flex flex-col items-center text-center px-6">
            <p class="text-gray-400 text-sm">Sin ítems de inventario registrados.</p>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class InventoryOverviewComponent implements OnInit {
  private inventoryService = inject(InventoryService);

  readonly columns: TableColumn<InventoryItem>[] = [
    { key: 'product', label: 'Producto', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'branch', label: 'Sucursal' },
    { key: 'stock', label: 'Stock actual' },
    { key: 'minStock', label: 'Stock mínimo' },
    { key: 'tenant', label: 'Tenant' },
  ];

  allItems = signal<InventoryItem[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  tenantFilter = signal('');
  branchFilter = signal('');

  filteredItems = () => {
    const t = this.tenantFilter().toLowerCase();
    const b = this.branchFilter().toLowerCase();
    return this.allItems().filter((item) => {
      const matchTenant = !t || item.tenantId.toLowerCase().includes(t);
      const matchBranch = !b || (item.branch?.name ?? '').toLowerCase().includes(b);
      return matchTenant && matchBranch;
    });
  };

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.inventoryService.getAllInventoryItems(this.page(), 100).subscribe({
      next: (res) => {
        this.allItems.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar el inventario global.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadItems();
  }
}
