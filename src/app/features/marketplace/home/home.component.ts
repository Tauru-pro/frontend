import { Component, signal, OnInit, OnDestroy, PLATFORM_ID, inject, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreedService } from '../../../core/services/breed.service';
import { ProductService } from '../../../core/services/product.service';
import { BullListing } from '../../../core/models/bull-listing.model';
import { BullListingCardComponent } from '../../../shared/components/bull-listing-card/bull-listing-card.component';
import { BreedFilterComponent } from '../../../shared/components/breed-filter/breed-filter.component';
import { Breed } from '../../../core/models/breed.model';

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

@Component({
  selector: 'app-home',
  imports: [RouterLink, BullListingCardComponent, BreedFilterComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './home.component.css',
})
export default class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private breedService = inject(BreedService);
  private productService = inject(ProductService);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  hours = signal(10);
  minutes = signal(45);
  seconds = signal(30);
  cartCount = signal(2);

  breeds = signal<Breed[]>([]);

  // "Semen Destacado": datos reales, un toro por vendedor con destacado.
  featuredBulls = signal<BullListing[]>([]);
  featuredLoading = signal(true);


  bestSellers: Product[] = [
    { id: 7, name: 'Contenedor Nitrógeno 35L', price: 520.00, originalPrice: 650.00, emoji: '❄️', badge: '20% Off', rating: 4.8, reviews: 342 },
    { id: 8, name: 'Kit Pistola IA Profesional', price: 89.00, emoji: '💉', badge: 'Nuevo', rating: 4.5, reviews: 156 },
    { id: 9, name: 'Cebu Brahman "BH-209 Elite"', price: 75.00, originalPrice: 95.00, emoji: '🧬', badge: 'Hot', rating: 4.7, reviews: 428 },
    { id: 10, name: 'Guantes Rectales x100 unid.', price: 18.99, emoji: '🧤', rating: 4.6, reviews: 267 },
  ];

  popularProducts: Product[] = [
    { id: 11, name: 'Catéteres IA x25', price: 12.50, originalPrice: 16.00, emoji: '💉', badge: 'Oferta', rating: 4.3, reviews: 97 },
    { id: 12, name: 'Vainas 0.5ml x200', price: 22.00, emoji: '🧪', badge: 'Nuevo', rating: 4.8, reviews: 184 },
    { id: 13, name: 'Angus "Force 309"', price: 55.00, originalPrice: 70.00, emoji: '🧬', badge: 'Best', rating: 4.7, reviews: 312 },
    { id: 14, name: 'Termo Transporte 3L', price: 180.00, emoji: '❄️', rating: 4.2, reviews: 76 },
    { id: 15, name: 'Brahman "Top Star 22"', price: 48.00, originalPrice: 62.00, emoji: '🐃', badge: 'Oferta', rating: 4.6, reviews: 241 },
    { id: 16, name: 'Descongelador Digital', price: 145.00, originalPrice: 180.00, emoji: '🔬', rating: 4.4, reviews: 158 },
    { id: 17, name: 'Gyr "BH-Rei 07"', price: 72.00, emoji: '🧬', badge: 'Import.', rating: 4.5, reviews: 89 },
    { id: 18, name: 'Nitrógeno Líquido 10L', price: 35.00, originalPrice: 45.00, emoji: '❄️', badge: 'Oferta', rating: 4.3, reviews: 113 },
  ];

  dealProduct: Product = {
    id: 99,
    name: 'Brahman Rojo Elite "BHR Champion 888"',
    price: 180.00,
    originalPrice: 290.00,
    emoji: '🐃',
    badge: '38% Off',
    rating: 4.9,
    reviews: 512,
  };

  get dealDiscount(): number {
    if (!this.dealProduct.originalPrice) return 0;
    return Math.round((1 - this.dealProduct.price / this.dealProduct.originalPrice) * 100);
  }

  ngOnInit() {
    this.productService.getFeaturedBulls().subscribe({
      next: (bulls) => {
        this.featuredBulls.set(bulls);
        this.featuredLoading.set(false);
      },
      error: () => this.featuredLoading.set(false),
    });

    this.breedService.getAll().subscribe({
      next: (breeds) => this.breeds.set(breeds),
    });

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

  addToCart(_product: Product) {
    this.cartCount.update((c) => c + 1);
  }

  addDealToCart() {
    this.addToCart(this.dealProduct);
  }

  stars(rating: number): string[] {
    return Array.from({ length: 5 }, (_, i) => (i < Math.floor(rating) ? '★' : '☆'));
  }
}
