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
import { Product } from '../../../core/models/product.model';
import { BullListing } from '../../../core/models/bull-listing.model';
import { Breed } from '../../../core/models/breed.model';
import { ProductCardComponent } from './product-card.component';
import { BullListingCardComponent } from '../../../shared/components/bull-listing-card/bull-listing-card.component';

/**
 * Genética e insumos son unidades distintas —un toro agrupa varias pajillas, un
 * insumo es un producto suelto—, así que cada pestaña tiene su consulta, su
 * `count` y su paginación. Mezclarlas obligaría a repartir a mano los elementos
 * de cada página entre dos consultas paginadas.
 */
export type CatalogSection = 'GENETICS' | 'SUPPLIES';

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, ProductCardComponent, BullListingCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
})
export default class CatalogComponent implements OnInit {
  private productService = inject(ProductService);
  private breedService = inject(BreedService);

  section = signal<CatalogSection>('GENETICS');

  bulls = signal<BullListing[]>([]);
  products = signal<Product[]>([]);
  breeds = signal<Breed[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);

  selectedBreed = signal<string>('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);

  isGenetics = computed(() => this.section() === 'GENETICS');
  /** La raza solo aplica a la genética: un insumo no tiene toro. */
  showBreedFilter = computed(() => this.isGenetics());
  hasResults = computed(() =>
    this.isGenetics() ? this.bulls().length > 0 : this.products().length > 0,
  );
  resultsLabel = computed(() =>
    this.isGenetics()
      ? `${this.totalItems()} ${this.totalItems() === 1 ? 'toro encontrado' : 'toros encontrados'}`
      : `${this.totalItems()} ${this.totalItems() === 1 ? 'producto encontrado' : 'productos encontrados'}`,
  );

  readonly limit = 12;

  ngOnInit(): void {
    this.breedService.getAll().subscribe({
      next: (b) => this.breeds.set(b),
    });
    this.load();
  }

  /** Cambia de pestaña conservando el precio; la raza no aplica a insumos. */
  selectSection(section: CatalogSection): void {
    if (this.section() === section) return;
    this.section.set(section);
    if (section === 'SUPPLIES') this.selectedBreed.set('');
    this.currentPage.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.isGenetics() ? this.loadBulls() : this.loadSupplies();
  }

  private loadBulls(): void {
    this.productService
      .getCatalogBulls(this.currentPage(), this.limit, {
        breedId: this.selectedBreed() || undefined,
        minPrice: this.minPrice() ?? undefined,
        maxPrice: this.maxPrice() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.bulls.set(res.data);
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

  private loadSupplies(): void {
    this.productService
      .getPublicCatalog(this.currentPage(), this.limit, {
        productType: 'SUPPLIES',
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
