import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Category } from '../../../features/marketplace/home/home.component';

@Component({
  selector: 'app-footer',
  imports: [],
  template: `<!-- ===== FOOTER ===== -->
<footer class="bg-footer text-gray-400 pt-12 pb-6">
  <div class="max-w-[1400px] mx-auto px-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">

      <!-- Brand column -->
      <div class="lg:col-span-2">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-9 h-9 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-lg">
            T
          </div>
          <div class="leading-none">
            <span class="text-xl font-bold text-white">Tauru</span>
            <span class="text-accent font-bold text-xl">.</span>
            <div class="text-[10px] text-gray-500 tracking-widest uppercase">Market</div>
          </div>
        </div>
        <p class="text-sm text-gray-500 leading-relaxed mb-4 max-w-xs">
          Your trusted online grocery store. Fresh, organic products sourced directly from local farms
          and delivered to your doorstep.
        </p>
        <div class="space-y-1.5 text-sm text-gray-500">
          <div class="flex items-center gap-2">
            <span>📞</span>
            <span>+1 (800) 123-4567</span>
          </div>
          <div class="flex items-center gap-2">
            <span>✉️</span>
            <span>support&#64;taurumarket.com</span>
          </div>
          <div class="flex items-center gap-2">
            <span>📍</span>
            <span>123 Fresh St, Greenville, CA 90210</span>
          </div>
        </div>
      </div>

      <!-- Quick Links -->
      <div>
        <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Quick Links</h4>
        <ul class="space-y-2.5 text-sm">
          @for (link of ['Home', 'About Us', 'Our Story', 'Careers', 'Blog', 'Contact Us']; track link) {
          <li>
            <a href="#" class="hover:text-accent transition-colors">{{ link }}</a>
          </li>
          }
        </ul>
      </div>

      <!-- Categories -->
      <div>
        <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Categories</h4>
        <ul class="space-y-2.5 text-sm">
          @for (cat of categories.slice(1, 7); track cat.slug) {
          <li>
            <a href="#" class="hover:text-accent transition-colors">{{ cat.name }}</a>
          </li>
          }
        </ul>
      </div>

      <!-- Information -->
      <div>
        <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Information</h4>
        <ul class="space-y-2.5 text-sm">
          @for (link of tracks; track link) {
          <li>
            <a href="#" class="hover:text-accent transition-colors">{{ link }}</a>
          </li>
          }
        </ul>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p class="text-xs text-gray-600">© 2026 Tauru Market. All rights reserved.</p>
      <div class="flex items-center gap-3 text-xl">
        @for (icon of ['📘', '🐦', '📷', '▶️', '📌']; track icon) {
        <span class="cursor-pointer hover:opacity-60 transition-opacity select-none">{{ icon }}</span>
        }
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-600">
        <span>We accept:</span>
        @for (method of ['VISA', 'MC', 'PayPal', 'Apple Pay']; track method) {
        <span class="bg-gray-800 text-gray-300 px-2 py-1 rounded font-medium">{{ method }}</span>
        }
      </div>
    </div>
  </div>
</footer>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  tracks: string[] = ['Privacy Policy', 'Terms & Conditions', 'Shipping Policy', 'Return Policy', 'FAQ', 'Track Order']
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
