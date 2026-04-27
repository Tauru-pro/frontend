import { Component, signal, OnInit, OnDestroy, PLATFORM_ID, inject, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  emoji: string;
  badge?: string;
  rating: number;
  reviews: number;
}

export interface Category {
  name: string;
  icon: string;
  slug: string;
}

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './home.component.css',
})
export default class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  hours = signal(10);
  minutes = signal(45);
  seconds = signal(30);
  cartCount = signal(2);


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


  featuredProducts: Product[] = [
    { id: 1, name: 'Organic Fresh Tomatoes', price: 4.99, originalPrice: 6.99, emoji: '🍅', badge: 'Organic', rating: 4.5, reviews: 128 },
    { id: 2, name: 'Premium Orange Juice', price: 3.49, originalPrice: 4.99, emoji: '🍊', badge: 'Sale', rating: 4.2, reviews: 85 },
    { id: 3, name: 'Whole Grain Bread', price: 2.99, emoji: '🍞', badge: 'Fresh', rating: 4.7, reviews: 214 },
    { id: 4, name: 'Almond Milk 1L', price: 5.49, originalPrice: 6.99, emoji: '🥛', badge: 'Vegan', rating: 4.4, reviews: 67 },
    { id: 5, name: 'Greek Yogurt Pack', price: 3.99, originalPrice: 5.49, emoji: '🫙', badge: 'Sale', rating: 4.6, reviews: 193 },
    { id: 6, name: 'Mixed Berry Jam', price: 4.29, emoji: '🫐', rating: 4.3, reviews: 42 },
  ];

  bestSellers: Product[] = [
    { id: 7, name: 'Atlantic Salmon Fillet', price: 12.99, originalPrice: 15.99, emoji: '🐟', badge: '20% Off', rating: 4.8, reviews: 342 },
    { id: 8, name: 'Avocado (per kg)', price: 7.49, emoji: '🥑', badge: 'New', rating: 4.5, reviews: 156 },
    { id: 9, name: 'Premium Coffee Blend', price: 11.99, originalPrice: 14.99, emoji: '☕', badge: 'Hot', rating: 4.7, reviews: 428 },
    { id: 10, name: 'Organic Honey 500g', price: 8.99, emoji: '🍯', badge: 'Organic', rating: 4.9, reviews: 267 },
  ];

  popularProducts: Product[] = [
    { id: 11, name: 'Sweet Corn Pack', price: 3.29, originalPrice: 4.49, emoji: '🌽', badge: 'Sale', rating: 4.3, reviews: 97 },
    { id: 12, name: 'Fresh Strawberries', price: 5.99, emoji: '🍓', badge: 'New', rating: 4.8, reviews: 184 },
    { id: 13, name: 'Olive Oil Extra Virgin', price: 9.49, originalPrice: 11.99, emoji: '🫒', badge: 'Best', rating: 4.7, reviews: 312 },
    { id: 14, name: 'Brown Rice 2kg', price: 4.79, emoji: '🍚', rating: 4.2, reviews: 76 },
    { id: 15, name: 'Dark Chocolate 70%', price: 3.99, originalPrice: 5.49, emoji: '🍫', badge: 'Sale', rating: 4.6, reviews: 241 },
    { id: 16, name: 'Peanut Butter 500g', price: 6.49, emoji: '🥜', rating: 4.4, reviews: 158 },
    { id: 17, name: 'Cherry Tomatoes', price: 3.79, emoji: '🍒', badge: 'Organic', rating: 4.5, reviews: 89 },
    { id: 18, name: 'Coconut Water 1L', price: 4.99, originalPrice: 6.49, emoji: '🥥', badge: 'Sale', rating: 4.3, reviews: 113 },
  ];

  dealProduct: Product = {
    id: 99,
    name: 'Fresh Organic Vegetables Bundle',
    price: 24.99,
    originalPrice: 39.99,
    emoji: '🥬',
    badge: '38% Off',
    rating: 4.8,
    reviews: 512,
  };

  get dealDiscount(): number {
    if (!this.dealProduct.originalPrice) return 0;
    return Math.round((1 - this.dealProduct.price / this.dealProduct.originalPrice) * 100);
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.timerInterval = setInterval(() => {
        const s = this.seconds();
        const m = this.minutes();
        const h = this.hours();
        if (s > 0) {
          this.seconds.set(s - 1);
        } else if (m > 0) {
          this.seconds.set(59);
          this.minutes.set(m - 1);
        } else if (h > 0) {
          this.seconds.set(59);
          this.minutes.set(59);
          this.hours.set(h - 1);
        }
      }, 1000);
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  addToCart(product: Product) {
    this.cartCount.update((c) => c + 1);
  }

  addDealToCart() {
    this.addToCart(this.dealProduct);
  }

  stars(rating: number): string[] {
    return Array.from({ length: 5 }, (_, i) => (i < Math.floor(rating) ? '★' : '☆'));
  }
}
