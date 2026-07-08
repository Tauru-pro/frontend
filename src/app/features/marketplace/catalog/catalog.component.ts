import {
  Component,
  signal,
  computed,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { BreedService } from '../../../core/services/breed.service';
import { Product, ProductType } from '../../../core/models/product.model';
import { Breed } from '../../../core/models/breed.model';
import { ProductCardComponent } from './product-card.component';

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
})
export default class CatalogComponent implements OnInit {
  private productService = inject(ProductService);
  private breedService = inject(BreedService);

  products = signal<Product[]>([]);
  breeds = signal<Breed[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);

  selectedType = signal<ProductType | ''>('');
  selectedBreed = signal<string>('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);

  showBreedFilter = computed(() => this.selectedType() === 'STRAW');

  readonly limit = 12;

  ngOnInit(): void {
    this.breedService.getAll().subscribe({
      next: (b) => this.breeds.set(b),
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const type = this.selectedType() || undefined;
    const breedId = (this.showBreedFilter() && this.selectedBreed()) ? this.selectedBreed() : undefined;

    this.productService
      .getPublicCatalog(this.currentPage(), this.limit, {
        productType: type as ProductType | undefined,
        breedId,
        minPrice: this.minPrice() ?? undefined,
        maxPrice: this.maxPrice() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.data);
          this.totalItems.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el catálogo. Intenta de nuevo.');
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.selectedType.set('');
    this.selectedBreed.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.currentPage.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }
}
