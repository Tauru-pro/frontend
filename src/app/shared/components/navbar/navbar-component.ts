import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category } from '../../../features/marketplace/home/home.component';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  template: `
  <!-- ===== ANNOUNCEMENT BAR ===== -->
<div class="bg-[#1A3D2A] text-white text-xs py-2 px-4">
  <div class="max-w-[1400px] mx-auto flex items-center justify-between">
    <div class="flex items-center gap-6">
      <span>📞 +1 (800) 123-4567</span>
      <span class="hidden md:inline">✉️ support&#64;taurumarket.com</span>
    </div>
    <span class="font-medium hidden md:inline">
      🚚 Free delivery on orders over $50 &nbsp;|&nbsp;
      Use code: <span class="text-[#C8812A] font-bold">FRESH10</span>
    </span>
    <div class="flex items-center gap-4 text-gray-300">
      <span class="cursor-pointer hover:text-white transition-colors">English ▾</span>
      <span class="cursor-pointer hover:text-white transition-colors">USD ▾</span>
    </div>
  </div>
</div>

<!-- ===== HEADER ===== -->
<header class="bg-[#0B1D2E] text-white py-3 sticky top-0 z-50 shadow-xl">
  <div class="max-w-[1400px] mx-auto px-4 flex items-center gap-5">

    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 flex-shrink-0">
      <div
        class="w-9 h-9 bg-[#C8812A] rounded-lg flex items-center justify-center font-bold text-white text-lg"
      >
        T
      </div>
      <div class="leading-none">
        <span class="text-xl font-bold text-white">Tauru</span>
        <span class="text-[#C8812A] font-bold text-xl">.</span>
        <div class="text-[10px] text-gray-400 tracking-widest uppercase">Market</div>
      </div>
    </a>

    <!-- Search -->
    <div class="flex-1 flex rounded-lg overflow-hidden border border-white/10 max-w-2xl mx-4">
      <select
        class="bg-[#C8812A] text-white text-sm font-medium px-3 py-2.5 outline-none cursor-pointer flex-shrink-0"
      >
        <option>All Categories</option>
        @for (cat of categories.slice(1); track cat.slug) {
          <option>{{ cat.name }}</option>
        }
      </select>
      <input
        type="text"
        placeholder="Search for fresh groceries, products..."
        class="flex-1 px-4 py-2.5 text-[#0B1D2E] text-sm outline-none min-w-0"
      />
      <button
        class="bg-[#C8812A] hover:bg-[#b8721a] px-5 py-2.5 text-white transition-colors flex-shrink-0"
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
      <a
        routerLink="/auth/sign-in"
        class="flex flex-col items-center gap-0.5 text-gray-300 hover:text-[#C8812A] transition-colors group"
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
        <span class="text-[10px]">Account</span>
      </a>

      <!-- Wishlist -->
      <button
        class="flex flex-col items-center gap-0.5 text-gray-300 hover:text-[#C8812A] transition-colors relative"
      >
        <div class="relative">
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
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          @if (wishlistCount() > 0) {
            <span
              class="absolute -top-2 -right-2 bg-[#C8812A] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold"
            >{{ wishlistCount() }}</span>
          }
        </div>
        <span class="text-[10px]">Wishlist</span>
      </button>

      <!-- Cart -->
      <button
        class="flex items-center gap-3 bg-[#C8812A] hover:bg-[#b8721a] px-4 py-2 rounded-lg transition-colors"
      >
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
          @if (cartCount() > 0) {
            <span
              class="absolute -top-2 -right-2 bg-[#0B1D2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold"
            >{{ cartCount() }}</span>
          }
        </div>
        <div class="text-white text-left hidden sm:block">
          <div class="text-[10px] opacity-75">My Cart</div>
          <div class="text-sm font-bold">$47.32</div>
        </div>
      </button>
    </div>
  </div>
</header>

<!-- ===== NAV BAR ===== -->
<nav class="bg-white border-b border-gray-200 shadow-sm">
  <div class="max-w-[1400px] mx-auto flex items-center">
    <div
      class="flex items-center gap-2 bg-[#0B1D2E] text-white px-5 py-3.5 cursor-pointer hover:bg-[#162a3d] transition-colors flex-shrink-0 select-none"
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
          class="px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 border-transparent hover:border-[#C8812A] hover:text-[#C8812A]"
          [class.text-[#C8812A]]="first"
          [class.border-[#C8812A]]="first"
          [class.text-[#0B1D2E]]="!first"
        >
          {{ link }}
        </a>
      }
    </div>
    <div class="ml-auto px-4 text-sm text-[#1A3D2A] font-medium flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
      <span>🌱</span>
      <span>100% Organic Products</span>
    </div>
  </div>
</nav>

  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  cartCount = signal(2);
  wishlistCount = signal(4);
  navLinks = ['Home', 'Shop', 'Deals', 'New Arrivals', 'About', 'Blog'];

  categories: Category[] = [
    { name: 'All Departments', icon: '🏪', slug: 'all' },
    { name: 'Vegetables & Fruits', icon: '🥦', slug: 'vegetables' },
    { name: 'Beverages', icon: '🥤', slug: 'beverages' },
    { name: 'Meats & Seafood', icon: '🥩', slug: 'meats' },
    { name: 'Bread & Bakery', icon: '🍞', slug: 'bakery' },
    { name: 'Milk & Dairy', icon: '🥛', slug: 'dairy' },
    { name: 'Dry Goods & Spices', icon: '🌶️', slug: 'spices' },
    { name: 'Frozen Food', icon: '🧊', slug: 'frozen' },
    { name: 'Wine & Spirits', icon: '🍷', slug: 'wine' },
    { name: 'Healthcare', icon: '💊', slug: 'health' },
  ];


}
