import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { UserProfile, UserRole, UserStatus } from '../../../core/models/user.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-users',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Usuarios</h1>
          <p class="text-sm text-gray-500 mt-0.5">Gestiona los usuarios del sistema</p>
        </div>
        <app-button iconPath="M12 4v16m8-8H4" (clicked)="router.navigate(['/admin/users/new'])">
          Nuevo Usuario
        </app-button>
      </div>

      <!-- Generic error -->
      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ errorMsg() }}
        </div>
      }

      <!-- Table -->
      <app-data-table
        [columns]="columns"
        [rows]="users()"
        [loading]="loading()"
        [page]="page()"
        [totalPages]="totalPages()"
        [total]="total()"
        itemLabel="usuarios"
        (pageChange)="onPageChange($event)"
      >
        <ng-template tableCell="user" let-user>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span class="text-white text-xs font-bold">{{ userInitial(user) }}</span>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate max-w-[180px]">{{ userName(user) }}</p>
              <p class="text-xs text-gray-400 truncate max-w-[180px]">{{ user.email }}</p>
            </div>
          </div>
        </ng-template>

        <ng-template tableCell="role" let-user>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + roleClass(user.role)">
            {{ roleLabel(user.role) }}
          </span>
        </ng-template>

        <ng-template tableCell="status" let-user>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(user.status)">
            {{ statusLabel(user.status) }}
          </span>
        </ng-template>

        <ng-template tableCell="createdAt" let-user>
          <span class="text-gray-400 text-xs">{{ formatDate(user.createdAt) }}</span>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin usuarios aún</p>
            <p class="text-gray-400 text-sm mb-5">Crea el primer usuario del sistema.</p>
            <app-button (clicked)="router.navigate(['/admin/users/new'])">
              Nuevo usuario
            </app-button>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class UsersComponent implements OnInit {
  protected router = inject(Router);
  private userService = inject(UserService);

  readonly columns: TableColumn<UserProfile>[] = [
    { key: 'user',      label: 'Usuario',  headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'role',      label: 'Rol' },
    { key: 'status',    label: 'Estado' },
    { key: 'createdAt', label: 'Creado' },
  ];

  users = signal<UserProfile[]>([]);
  total = signal(0);
  totalPages = signal(0);
  page = signal(1);
  loading = signal(false);
  confirmDelete = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.userService.getUsers(this.page(), 10).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar los usuarios. Intenta de nuevo.');
      },
    });
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.loadUsers();
  }

  userInitial(user: UserProfile): string {
    return (user.buyerProfile?.fullName?.[0] ?? user.email[0]).toUpperCase();
  }

  userName(user: UserProfile): string {
    return user.buyerProfile?.fullName ?? '—';
  }

  roleClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      ADMIN: 'bg-purple-50 text-purple-700',
      SELLER: 'bg-blue-50 text-blue-700',
      BUYER: 'bg-gray-100 text-gray-600',
    };
    return map[role] ?? 'bg-gray-100 text-gray-600';
  }

  roleLabel(role: UserRole): string {
    const map: Record<UserRole, string> = {
      ADMIN: 'Admin',
      SELLER: 'Vendedor',
      BUYER: 'Comprador',
    };
    return map[role] ?? role;
  }

  statusClass(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      INACTIVE: 'bg-gray-100 text-gray-500',
      SUSPENDED: 'bg-red-50 text-red-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  statusLabel(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      ACTIVE: 'Activo',
      INACTIVE: 'Inactivo',
      SUSPENDED: 'Suspendido',
    };
    return map[status] ?? status;
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
