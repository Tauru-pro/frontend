import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { SellerProfile, SellerStatus } from '../../../core/models/user.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-sellers',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Vendedores</h1>
          <p class="text-sm text-gray-500 mt-0.5">Proveedores de semen taurino</p>
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="sellers()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="vendedores"
        (pageChange)="onPageChange($event)"
      >
        <ng-template tableCell="seller" let-s>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span class="text-white text-xs font-bold">{{ sellerInitial(s) }}</span>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate max-w-[180px]">{{ s.bussinesName ?? '—' }}</p>
      
            </div>
          </div>
        </ng-template>

        <ng-template tableCell="city" let-s>
          <span class="text-sm text-gray-700">{{ s?.city?.name ?? '—' }}</span>
        </ng-template>

        <ng-template tableCell="phone" let-s>
          <span class="text-sm text-gray-700">{{ s?.contactPhone ?? '—' }}</span>
        </ng-template>

        <ng-template tableCell="status" let-s>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + sellerStatusClass(s.status)">
            {{ sellerStatusLabel(s.status) }}
          </span>
        </ng-template>

        <ng-template tableCell="createdAt" let-s>
          <span class="text-gray-400 text-xs">{{ formatDate(s.createdAt) }}</span>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin vendedores aún</p>
            <p class="text-gray-400 text-sm">No hay vendedores registrados en el sistema.</p>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class SellersComponent implements OnInit {
  protected router = inject(Router);
  private userService = inject(UserService);

  readonly columns: TableColumn<SellerProfile>[] = [
    { key: 'seller', label: 'Vendedor', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'city', label: 'Ciudad' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'status', label: 'Estado' },
    { key: 'createdAt', label: 'Registrado' },
  ];

  sellers = signal<SellerProfile[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSellers();
  }

  async loadSellers(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const res = await this.userService.getSellers(this.page(), 10);
      this.sellers.set(res.data);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } catch {
      this.errorMsg.set('No se pudo cargar los vendedores. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadSellers();
  }

  sellerInitial(seller: SellerProfile): string {
    return (seller?.bussinesName[0] ?? '').toUpperCase();
  }

  sellerStatusClass(status?: SellerStatus): string {
    const map: Record<SellerStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      PENDING: 'bg-yellow-50 text-yellow-700',
      SUSPENDED: 'bg-red-50 text-red-500',
    };
    return status ? (map[status] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-500';
  }

  sellerStatusLabel(status?: SellerStatus): string {
    const map: Record<SellerStatus, string> = {
      ACTIVE: 'Activo',
      PENDING: 'Pendiente',
      SUSPENDED: 'Suspendido',
    };
    return status ? (map[status] ?? status) : '—';
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
