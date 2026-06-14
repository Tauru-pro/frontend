import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BranchService } from '../../../core/services/branch.service';
import { Branch, BranchStatus } from '../../../core/models/branch.model';
import {
  DataTableComponent,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { TableCellDirective, TableEmptyDirective } from '../../../shared/directives';

@Component({
  selector: 'app-branch-list',
  imports: [DataTableComponent, TableCellDirective, TableEmptyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Mis Sucursales</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona las sedes de tu negocio</p>
        </div>
        <button
          type="button"
          (click)="router.navigate(['/seller/branches/new'])"
          class="flex items-center gap-2 btn-primary px-4 py-2.5 text-sm"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nueva Sucursal
        </button>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="branches()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="sucursales"
        (pageChange)="onPageChange($event)"
      >

        <ng-template tableCell="name" let-branch>
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900">{{ branch.name }}</span>
            @if (branch.isMain) {
              <span class="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Principal
              </span>
            }
          </div>
        </ng-template>

        <ng-template tableCell="location" let-branch>
          <span class="text-gray-600 text-sm">
            {{ branch.city?.name }}, {{ branch.city?.state?.name }}
          </span>
        </ng-template>

        <ng-template tableCell="address" let-branch>
          <span class="text-gray-500 text-sm max-w-[200px] truncate block">{{ branch.address }}</span>
        </ng-template>

        <ng-template tableCell="phone" let-branch>
          <span class="text-gray-500 text-sm">{{ branch.phone ?? '—' }}</span>
        </ng-template>

        <ng-template tableCell="status" let-branch>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(branch.status)">
            {{ statusLabel(branch.status) }}
          </span>
        </ng-template>

        <ng-template tableCell="actions" let-branch>
          <div class="flex items-center gap-1 justify-end">
            @if (!branch.isMain) {
              <button
                type="button"
                (click)="onSetMain(branch.id)"
                [disabled]="settingMain() === branch.id"
                class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all disabled:opacity-40"
                title="Establecer como principal"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"/>
                </svg>
              </button>
            }
            <button
              type="button"
              (click)="router.navigate(['/seller/branches', branch.id, 'edit'])"
              class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
              title="Editar"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button
              type="button"
              (click)="confirmDelete.set(branch.id)"
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin sucursales aún</p>
            <p class="text-gray-400 text-sm mb-5">Registra tu primera sucursal para mejorar tu presencia.</p>
            <button
              type="button"
              (click)="router.navigate(['/seller/branches/new'])"
              class="btn-primary px-5 py-2.5 text-sm"
            >
              Crear sucursal
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
          <h3 class="font-semibold text-gray-900 mb-1">Eliminar sucursal</h3>
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
export default class BranchListComponent implements OnInit {
  protected router = inject(Router);
  private branchService = inject(BranchService);

  readonly columns: TableColumn<Branch>[] = [
    { key: 'name', label: 'Nombre', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'location', label: 'Ciudad' },
    { key: 'address', label: 'Dirección' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: '', headerClass: 'px-4 py-3 w-28' },
  ];

  branches = signal<Branch[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  confirmDelete = signal<string | null>(null);
  deleting = signal(false);
  settingMain = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.branchService.getMyBranches(this.page(), 10).subscribe({
      next: (res) => {
        this.branches.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudieron cargar las sucursales. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadBranches();
  }

  async onSetMain(id: string): Promise<void> {
    this.settingMain.set(id);
    this.errorMsg.set(null);
    try {
      await firstValueFrom(this.branchService.setMain(id));
      this.branches.update(list =>
        list.map(b => ({ ...b, isMain: b.id === id })),
      );
    } catch {
      this.errorMsg.set('No se pudo establecer la sucursal principal. Intenta de nuevo.');
    } finally {
      this.settingMain.set(null);
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
      await firstValueFrom(this.branchService.deleteBranch(id));
      this.confirmDelete.set(null);
      this.branches.update(list => list.filter(b => b.id !== id));
      this.total.update(n => n - 1);
    } catch {
      this.confirmDelete.set(null);
      this.errorMsg.set('No se pudo eliminar la sucursal. Intenta de nuevo.');
    } finally {
      this.deleting.set(false);
    }
  }

  statusClass(status: BranchStatus): string {
    return status === 'ACTIVE'
      ? 'bg-green-50 text-green-700'
      : 'bg-gray-100 text-gray-500';
  }

  statusLabel(status: BranchStatus): string {
    return status === 'ACTIVE' ? 'Activa' : 'Inactiva';
  }
}
