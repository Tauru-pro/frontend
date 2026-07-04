import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';
import { ProductService } from '../../../core/services/product.service';
import { BranchService } from '../../../core/services/branch.service';
import { firstValueFrom } from 'rxjs';
import { MovementType } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-list',
  imports: [DataTableComponent, TableCellDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Inventario</h1>
          <p class="text-sm text-gray-500 mt-0.5">Control de stock por producto y sucursal</p>
        </div>
        <button
          type="button"
          (click)="showForm.set(true)"
          class="flex items-center gap-2 btn-primary px-4 py-2.5 text-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Registrar movimiento
        </button>
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
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
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
            <span class="font-semibold text-gray-900">{{ item.currentStock }}</span>
            @if (isLowStock(item)) {
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                Stock bajo
              </span>
            }
          </div>
        </ng-template>

        <ng-template tableCell="minStock" let-item>
          <span class="text-gray-500 text-sm">{{ item.minStockQuantity }}</span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <button
            type="button"
            (click)="router.navigate(['/seller/inventory', item.id])"
            class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
            title="Ver historial"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </button>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin registros de inventario</p>
            <p class="text-gray-400 text-sm mb-5">Registra tu primer movimiento de entrada para comenzar.</p>
            <button
              type="button"
              (click)="showForm.set(true)"
              class="btn-primary px-5 py-2.5 text-sm"
            >
              Registrar movimiento
            </button>
          </div>
        </ng-template>
      </app-data-table>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-semibold text-gray-900">Registrar movimiento</h3>
            <button type="button" (click)="closeForm()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          @if (formError()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
              {{ formError() }}
            </div>
          }

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Producto</label>
              <select
                [value]="form().productId"
                (change)="updateForm('productId', $any($event.target).value)"
                class="form-input w-full"
              >
                <option value="">Selecciona un producto</option>
                @for (p of products(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
              <select
                [value]="form().branchId"
                (change)="updateForm('branchId', $any($event.target).value)"
                class="form-input w-full"
              >
                <option value="">Selecciona una sucursal</option>
                @for (b of branches(); track b.id) {
                  <option [value]="b.id">{{ b.name }}</option>
                }
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de movimiento</label>
              <select
                [value]="form().movementType"
                (change)="updateForm('movementType', $any($event.target).value)"
                class="form-input w-full"
              >
                <option value="ENTRY">Entrada</option>
                <option value="EXIT">Salida</option>
                <option value="ADJUSTMENT">Ajuste</option>
                <option value="SALE">Venta</option>
                <option value="CANCELLATION">Cancelación</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input
                type="number"
                [value]="form().quantity"
                (input)="updateForm('quantity', +$any($event.target).value)"
                class="form-input w-full"
                placeholder="0"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Notas <span class="text-gray-400">(opcional)</span></label>
              <textarea
                [value]="form().notes"
                (input)="updateForm('notes', $any($event.target).value)"
                class="form-input w-full resize-none"
                rows="2"
                placeholder="Observaciones del movimiento…"
              ></textarea>
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button
              type="button"
              (click)="closeForm()"
              [disabled]="saving()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="onSaveMovement()"
              [disabled]="saving()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-secondary rounded-xl hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              @if (saving()) { Guardando… } @else { Registrar }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export default class InventoryListComponent implements OnInit {
  protected router = inject(Router);
  private inventoryService = inject(InventoryService);
  private productService = inject(ProductService);
  private branchService = inject(BranchService);

  readonly columns: TableColumn<InventoryItem>[] = [
    { key: 'product', label: 'Producto', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'branch', label: 'Sucursal' },
    { key: 'stock', label: 'Stock actual' },
    { key: 'minStock', label: 'Stock mínimo' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-16' },
  ];

  items = signal<InventoryItem[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  showForm = signal(false);
  saving = signal(false);
  formError = signal<string | null>(null);
  products = signal<{ id: string; name: string }[]>([]);
  branches = signal<{ id: string; name: string }[]>([]);

  form = signal({
    productId: '',
    branchId: '',
    movementType: 'ENTRY' as MovementType,
    quantity: 1,
    notes: '',
  });

  ngOnInit(): void {
    this.loadItems();
    this.loadFormOptions();
  }

  loadItems(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.inventoryService.getMyInventoryItems(this.page(), 20).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar el inventario. Intenta de nuevo.');
      },
    });
  }

  private loadFormOptions(): void {
    firstValueFrom(this.productService.getMyProducts(1, 100)).then((res) => {
      this.products.set(res.data.map((p) => ({ id: p.id, name: p.name })));
    });
    firstValueFrom(this.branchService.getMyBranches(1, 100)).then((res) => {
      this.branches.set(res.data.map((b) => ({ id: b.id, name: b.name })));
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadItems();
  }

  isLowStock(item: InventoryItem): boolean {
    return item.currentStock <= item.minStockQuantity;
  }

  updateForm<K extends keyof ReturnType<typeof this.form>>(
    key: K,
    value: ReturnType<typeof this.form>[K],
  ): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  closeForm(): void {
    this.showForm.set(false);
    this.formError.set(null);
    this.form.set({ productId: '', branchId: '', movementType: 'ENTRY', quantity: 1, notes: '' });
  }

  async onSaveMovement(): Promise<void> {
    const f = this.form();
    if (!f.productId || !f.branchId) {
      this.formError.set('Selecciona un producto y una sucursal.');
      return;
    }
    if (f.quantity < 1) {
      this.formError.set('La cantidad debe ser al menos 1.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      await this.inventoryService.createMovement({
        productId: f.productId,
        branchId: f.branchId,
        movementType: f.movementType,
        quantity: f.quantity,
        notes: f.notes || undefined,
      });
      this.closeForm();
      this.loadItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el movimiento.';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }
}
