import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BreedService } from '../../../core/services/breed.service';
import { Breed } from '../../../core/models/breed.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-breeds',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Razas</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona el catálogo de razas bovinas</p>
        </div>
        <app-button iconPath="M12 4v16m8-8H4" (clicked)="router.navigate(['/admin/breeds/new'])">
          Nueva Raza
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
        itemLabel="razas"
      >
        <ng-template tableCell="name" let-item>
          <span class="text-sm font-medium text-gray-900">{{ item.name }}</span>
        </ng-template>

        <ng-template tableCell="purpose" let-item>
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            [class.bg-blue-50]="item.purpose === 'MILK'"
            [class.text-blue-700]="item.purpose === 'MILK'"
            [class.bg-orange-50]="item.purpose === 'MEAT'"
            [class.text-orange-700]="item.purpose === 'MEAT'"
          >
            {{ item.purpose === 'MILK' ? '🐄 Leche' : '🐂 Carne' }}
          </span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <div class="flex items-center gap-2">
            <button
              (click)="router.navigate(['/admin/breeds', item.id, 'edit'])"
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin razas registradas</p>
            <p class="text-gray-400 text-sm mb-5">Crea la primera raza del catálogo.</p>
            <app-button (clicked)="router.navigate(['/admin/breeds/new'])">
              Nueva raza
            </app-button>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class BreedsComponent implements OnInit {
  protected router = inject(Router);
  private service = inject(BreedService);

  readonly columns: TableColumn<Breed>[] = [
    { key: 'name', label: 'Nombre', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'purpose', label: 'Propósito' },
    { key: 'actions', label: '' },
  ];

  items = signal<Breed[]>([]);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.service.getAll().subscribe({
      next: (res) => {
        this.items.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar las razas. Intenta de nuevo.');
      },
    });
  }

  async onDelete(item: Breed): Promise<void> {
    if (!confirm(`¿Eliminar la raza "${item.name}"?`)) return;
    try {
      await firstValueFrom(this.service.delete(item.id));
      this.load();
    } catch {
      this.errorMsg.set('No se pudo eliminar la raza. Intenta de nuevo.');
    }
  }
}
