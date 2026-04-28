import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserStore } from '../../core/store/user.store';

interface NavItem {
  label: string;
  path: string;
  icon: SafeHtml;
}

@Component({
  selector: 'app-seller-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen overflow-hidden bg-gray-50">

      <!-- Mobile overlay -->
      @if (sidebarOpen()) {
        <div
          class="fixed inset-0 bg-black/40 z-20 lg:hidden"
          (click)="sidebarOpen.set(false)"
        ></div>
      }

      <!-- Sidebar -->
      <aside
        [class]="sidebarOpen()
          ? 'fixed inset-y-0 left-0 z-30 w-64 bg-[#0B1D2E] flex flex-col transition-transform duration-300 translate-x-0'
          : 'fixed inset-y-0 left-0 z-30 w-64 bg-[#0B1D2E] flex flex-col transition-transform duration-300 -translate-x-full lg:translate-x-0'"
      >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div class="w-8 h-8 bg-[#C8812A] rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white font-bold text-sm">T</span>
          </div>
          <span class="text-white font-semibold text-sm tracking-wide">Tauru · Vendedor</span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-white/10 text-white"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all"
              (click)="sidebarOpen.set(false)"
            >
              <span class="w-5 h-5 flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5" [innerHTML]="item.icon"></span>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- User info + sign out -->
        <div class="px-3 pb-4 border-t border-white/10 pt-4">
          <div class="flex items-center gap-3 px-3 mb-3">
            <div class="w-8 h-8 bg-[#C8812A] rounded-full flex items-center justify-center flex-shrink-0">
              <span class="text-white text-xs font-bold">{{ userInitial() }}</span>
            </div>
            <div class="min-w-0">
              <p class="text-white text-xs font-medium truncate">{{ userEmail() }}</p>
              <p class="text-[#C8812A] text-[10px] font-semibold uppercase tracking-wider">Vendedor</p>
            </div>
          </div>
          <button
            type="button"
            (click)="signOut()"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <!-- Main area -->
      <div class="flex-1 flex flex-col min-w-0 lg:pl-64">

        <!-- Header -->
        <header class="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
          <div class="flex items-center gap-4">
            <!-- Hamburger (mobile) -->
            <button
              type="button"
              class="lg:hidden text-gray-400 hover:text-gray-600 transition-colors"
              (click)="sidebarOpen.set(!sidebarOpen())"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <span class="text-sm font-semibold text-gray-800">Portal Vendedor</span>
          </div>

          <!-- Avatar -->
          <div class="w-8 h-8 bg-[#0B1D2E] rounded-full flex items-center justify-center">
            <span class="text-white text-xs font-bold">{{ userInitial() }}</span>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-y-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class SellerLayoutComponent {
  private authService = inject(AuthService);
  private userStore   = inject(UserStore);
  private router      = inject(Router);
  private sanitizer   = inject(DomSanitizer);

  sidebarOpen = signal(false);

  userEmail   = computed(() => this.userStore.user()?.email ?? '');
  userInitial = computed(() => (this.userStore.user()?.email?.[0] ?? 'V').toUpperCase());

  private svg(raw: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  }

  navItems: NavItem[] = [
    {
      label: 'Mis Productos',
      path: '/seller/products',
      icon: this.svg(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`),
    },
  ];

  signOut(): void {
    this.authService.logout().then(() => this.router.navigate(['/auth/sign-in']));
  }
}
