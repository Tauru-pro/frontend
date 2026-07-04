import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem, InventoryMovement, MovementType } from '../../../core/models/inventory.model';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  SALE: 'Venta',
  CANCELLATION: 'Cancelación',
};

const MOVEMENT_CLASSES: Record<MovementType, string> = {
  ENTRY: 'bg-green-50 text-green-700',
  EXIT: 'bg-red-50 text-red-600',
  ADJUSTMENT: 'bg-blue-50 text-blue-700',
  SALE: 'bg-orange-50 text-orange-700',
  CANCELLATION: 'bg-yellow-50 text-yellow-700',
};

@Component({
  selector: 'app-inventory-detail',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center gap-3">
        <button
          type="button"
          (click)="router.navigate(['/seller/inventory'])"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </button>
        <div>
          <h1 class="text-xl font-bold text-gray-900">Inventario: {{ item()?.product?.name ?? '…' }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">Sucursal: {{ item()?.branch?.name ?? '…' }}</p>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      @if (item(); as it) {
        <!-- Stock overview cards -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div class="card p-4">
            <p class="text-xs text-gray-500 mb-1">Stock actual</p>
            <p class="text-2xl font-bold" [class]="isLowStock(it) ? 'text-red-600' : 'text-gray-900'">
              {{ it.currentStock }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs text-gray-500 mb-1">Stock mínimo</p>
            <div class="flex items-center gap-2">
              @if (editingMinStock()) {
                <input
                  type="number"
                  [value]="minStockInput()"
                  (input)="minStockInput.set(+$any($event.target).value)"
                  class="form-input w-24 text-sm py-1"
                />
                <button type="button" (click)="saveMinStock(it.id)" [disabled]="savingMin()" class="text-xs text-secondary font-medium hover:underline disabled:opacity-40">
                  {{ savingMin() ? 'Guardando…' : 'Guardar' }}
                </button>
                <button type="button" (click)="editingMinStock.set(false)" class="text-xs text-gray-400 hover:underline">Cancelar</button>
              } @else {
                <p class="text-2xl font-bold text-gray-900">{{ it.minStockQuantity }}</p>
                <button type="button" (click)="startEditMin(it)" class="text-xs text-primary hover:underline">Editar</button>
              }
            </div>
          </div>
          @if (isLowStock(it)) {
            <div class="card p-4 border border-red-200 bg-red-50">
              <div class="flex items-center gap-2 text-red-600">
                <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <div>
                  <p class="text-sm font-semibold">Stock bajo</p>
                  <p class="text-xs">Repone el inventario pronto</p>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- New movement form -->
        <div class="card p-5">
          <h2 class="font-semibold text-gray-900 mb-4">Registrar movimiento</h2>

          @if (formError()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
              {{ formError() }}
            </div>
          }

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Notas <span class="text-gray-400">(opcional)</span></label>
              <textarea
                [value]="form().notes"
                (input)="updateForm('notes', $any($event.target).value)"
                class="form-input w-full resize-none"
                rows="2"
                placeholder="Observaciones…"
              ></textarea>
            </div>
          </div>

          <div class="flex justify-end mt-4">
            <button
              type="button"
              (click)="onSaveMovement(it)"
              [disabled]="saving()"
              class="btn-primary px-5 py-2.5 text-sm"
            >
              @if (saving()) { Guardando… } @else { Registrar movimiento }
            </button>
          </div>
        </div>

        <!-- Movement history -->
        <div class="card overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900">Historial de movimientos</h2>
          </div>

          @if (loadingMovements()) {
            <div class="p-8 flex justify-center">
              <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          } @else if (movements().length === 0) {
            <div class="py-10 flex flex-col items-center text-center px-6">
              <p class="text-gray-400 text-sm">Sin movimientos registrados aún.</p>
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delta</th>
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                    <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  @for (m of movements(); track m.id) {
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-5 py-3">
                        <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + movementClass(m.movementType)">
                          {{ movementLabel(m.movementType) }}
                        </span>
                      </td>
                      <td class="px-5 py-3 font-medium text-gray-900">{{ m.quantity }}</td>
                      <td class="px-5 py-3" [class]="m.delta > 0 ? 'text-green-600' : 'text-red-600'">
                        {{ m.delta > 0 ? '+' : '' }}{{ m.delta }}
                      </td>
                      <td class="px-5 py-3 font-semibold text-gray-900">{{ m.resultingBalance }}</td>
                      <td class="px-5 py-3 text-gray-500 max-w-[200px] truncate">{{ m.notes ?? '—' }}</td>
                      <td class="px-5 py-3 text-gray-400">{{ formatDate(m.createdAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class InventoryDetailComponent implements OnInit {
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private inventoryService = inject(InventoryService);

  item = signal<InventoryItem | null>(null);
  movements = signal<InventoryMovement[]>([]);
  loading = signal(false);
  loadingMovements = signal(false);
  errorMsg = signal<string | null>(null);
  formError = signal<string | null>(null);
  saving = signal(false);

  editingMinStock = signal(false);
  minStockInput = signal(0);
  savingMin = signal(false);

  form = signal({
    movementType: 'ENTRY' as MovementType,
    quantity: 1,
    notes: '',
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('itemId');
    if (id) this.loadItem(id);
  }

  private loadItem(id: string): void {
    this.loading.set(true);
    this.inventoryService.getInventoryItem(id).subscribe({
      next: (item) => {
        this.item.set(item);
        this.loading.set(false);
        this.loadMovements(id);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar el ítem de inventario.');
      },
    });
  }

  private loadMovements(itemId: string): void {
    this.loadingMovements.set(true);
    this.inventoryService.getMovements(itemId).subscribe({
      next: (movements) => {
        this.movements.set(movements);
        this.loadingMovements.set(false);
      },
      error: () => this.loadingMovements.set(false),
    });
  }

  isLowStock(item: InventoryItem): boolean {
    return item.currentStock <= item.minStockQuantity;
  }

  startEditMin(item: InventoryItem): void {
    this.minStockInput.set(item.minStockQuantity);
    this.editingMinStock.set(true);
  }

  async saveMinStock(itemId: string): Promise<void> {
    this.savingMin.set(true);
    try {
      const updated = await this.inventoryService.updateMinStock(itemId, {
        minStockQuantity: this.minStockInput(),
      });
      this.item.set(updated);
      this.editingMinStock.set(false);
    } catch {
      this.errorMsg.set('No se pudo actualizar el stock mínimo.');
    } finally {
      this.savingMin.set(false);
    }
  }

  updateForm<K extends keyof ReturnType<typeof this.form>>(
    key: K,
    value: ReturnType<typeof this.form>[K],
  ): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  async onSaveMovement(item: InventoryItem): Promise<void> {
    const f = this.form();
    const type = f.movementType;
    const qty = f.quantity;

    if (qty < 1) {
      this.formError.set('La cantidad debe ser al menos 1.');
      return;
    }
    if ((type === 'EXIT' || type === 'SALE') && qty > item.currentStock) {
      this.formError.set(
        `Stock insuficiente. El stock actual es ${item.currentStock} unidades.`,
      );
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    try {
      await this.inventoryService.createMovement({
        productId: item.productId,
        branchId: item.branchId,
        movementType: type,
        quantity: qty,
        notes: f.notes || undefined,
      });
      this.form.set({ movementType: 'ENTRY', quantity: 1, notes: '' });
      this.loadItem(item.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el movimiento.';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  movementLabel(type: MovementType): string {
    return MOVEMENT_LABELS[type];
  }

  movementClass(type: MovementType): string {
    return MOVEMENT_CLASSES[type];
  }

  formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
