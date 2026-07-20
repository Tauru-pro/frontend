import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Category } from '../../../features/marketplace/home/home.component';
import { AuthService } from '../../../core/auth/auth.service';
import { UserStore } from '../../../core/store/user.store';

import { HasRoleDirective } from '../../directives/has-role.directive';
import { CartStore } from '../../../core/store/cart.store';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, HasRoleDirective],
  template: `
    <!-- ===== ANNOUNCEMENT BAR ===== 
<div class="bg-dark text-white text-xs py-2 px-4">
  <div class="max-w-[1400px] mx-auto flex items-center justify-between">
    <div class="flex items-center gap-6">
      <span>📞 +1 (800) 123-4567</span>
      <span class="hidden md:inline">✉️ support&#64;taurumarket.com</span>
    </div>
    <span class="font-medium hidden md:inline">
      🚚 Free delivery on orders over $50 &nbsp;|&nbsp;
      Use code: <span class="text-accent font-bold">FRESH10</span>
    </span>
    <div class="flex items-center gap-4 text-gray-300">
      <span class="cursor-pointer hover:text-white transition-colors">English ▾</span>
      <span class="cursor-pointer hover:text-white transition-colors">USD ▾</span>
    </div>
  </div>
</div>
-->
    <!-- ===== HEADER ===== -->
    <header class="bg-primary text-white py-3 sticky top-0 z-50 shadow-xl">
      <div class="max-w-[1400px] mx-auto px-4 flex items-center gap-5">
        <!-- Logo -->
        <a href="/" class="flex-shrink-0">
          <img
            src="/brand/logotipo.png"
            alt="TAUVO — The Bulls Marketplace"
            class="h-14 w-auto rounded-md"
          />
        </a>

        <!-- Search -->
        <div class="flex-1 flex rounded-lg overflow-hidden border border-white/10 max-w-2xl mx-4">
          <select
            class="bg-secondary text-white text-sm font-medium px-3 py-2.5 outline-none cursor-pointer flex-shrink-0"
          >
            <option>All Categories</option>
            @for (cat of categories.slice(1); track cat.slug) {
              <option>{{ cat.name }}</option>
            }
          </select>
          <input
            type="text"
            placeholder="Search for fresh groceries, products..."
            class="flex-1 px-4 py-2.5 text-primary text-sm outline-none min-w-0"
          />
          <button
            class="bg-secondary hover:bg-secondary-dark px-5 py-2.5 text-white transition-colors flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>

        <!-- Icons -->
        <div class="flex items-center gap-4 ml-auto flex-shrink-0">
          <!-- Account -->
          @if (!isAuthenticated()) {
            <a
              routerLink="/auth/sign-in"
              class="flex flex-col items-center gap-0.5 text-gray-300 hover:text-accent transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span class="text-[10px]">Cuenta</span>
            </a>
          } @else {
            <div class="relative group">
              <button
                class="flex flex-col items-center gap-0.5 text-gray-300 hover:text-accent transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span class="text-[10px] max-w-[72px] truncate">{{ userName() }}</span>
              </button>
              <div
                class="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg py-1 min-w-[180px] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 z-50"
              >
                <a
                  routerLink="/profile"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Mi perfil
                </a>
                <a
                  *hasRole="['CUSTOMER']"
                  routerLink="/become-seller"
                  class="w-full text-left px-4 py-2.5 text-sm text-primary font-semibold hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 3h18v4H3zM5 7v12a1 1 0 001 1h12a1 1 0 001-1V7M9 12h6"
                    />
                  </svg>
                  Quiero ser proveedor
                </a>
                <a
                  *hasRole="['ADMIN', 'SELLER']"
                  [routerLink]="dashboardRoute()"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Dashboard
                </a>
                <button
                  (click)="logout()"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          }

          <!-- Cart -->
          <a routerLink="/cart" class="flex items-center gap-3 btn-secondary px-4 py-2">
            <div class="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              @if (cartStore.count() > 0) {
                <span
                  class="absolute -top-2 -right-2 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold"
                  >{{ cartStore.count() }}</span
                >
              }
            </div>
            <div class="text-white text-left hidden sm:block">
              <div class="text-[10px] opacity-75">Mi Carrito</div>
              <div class="text-sm font-bold">{{ cartTotalDisplay() }}</div>
            </div>
          </a>
        </div>
      </div>
    </header>

    <!-- ===== NAV BAR ===== -->
    <!-- <nav class="bg-white border-b border-gray-200 shadow-sm">
  <div class="max-w-[1400px] mx-auto flex items-center">
    <div
      class="flex items-center gap-2 bg-primary text-white px-5 py-3.5 cursor-pointer hover:bg-primary-dark transition-colors flex-shrink-0 select-none"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      <span class="font-medium text-sm whitespace-nowrap">All Departments</span>
    </div>
    <div class="flex items-center overflow-x-auto scrollbar-hide">
      @for (link of navLinks; track link; let first = $first) {
        <a
          href="#"
          class="px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 border-transparent hover:border-accent hover:text-accent"
          [class.text-accent]="first"
          [class.border-accent]="first"
          [class.text-primary]="!first"
        >
          {{ link }}
        </a>
      }
    </div>
    <div class="ml-auto px-4 text-sm text-secondary font-medium flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
      <span>🌱</span>
      <span>100% Organic Products</span>
    </div>
  </div>
</nav> -->
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  private authService = inject(AuthService);
  private userStore = inject(UserStore);
  private router = inject(Router);
  cartStore = inject(CartStore);
  cartTotalDisplay = computed(() => '$' + this.cartStore.total().toFixed(2));

  // navLinks = ['Home', 'Shop', 'Deals', 'New Arrivals', 'About', 'Blog'];

  isAuthenticated = computed(() => this.authService.currentUser() !== null);
  userName = computed(() => this.userStore.user()?.fullName ?? 'User');
  dashboardRoute = computed(() => {
    const role = this.userStore.user()?.role;
    return role === 'ADMIN' || role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/seller';
  });

  categories: Category[] = [
    { name: 'All Categories', icon: '🏪', slug: 'all' },
    { name: 'Semen de Toro', icon: '🧬', slug: 'bull-semen' },
    { name: 'Insumos de IA', icon: '💉', slug: 'ia-supplies' },
    { name: 'Nitrógeno Líquido', icon: '❄️', slug: 'nitrogen' },
    { name: 'Equipos de IA', icon: '🔬', slug: 'equipment' },
    { name: 'Genética Importada', icon: '🌎', slug: 'imported' },
    { name: 'Razas Criollas', icon: '🐂', slug: 'creole' },
    { name: 'Reproductores Brahman', icon: '🐃', slug: 'brahman' },
    { name: 'Suplementos', icon: '💊', slug: 'supplements' },
    { name: 'Certificados', icon: '📋', slug: 'certificates' },
  ];

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/auth/sign-in']);
  }
}
