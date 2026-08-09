import {
  Component,
  signal,
  computed,
  DestroyRef,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { BreedService } from '../../../core/services/breed.service';
import { Product } from '../../../core/models/product.model';
import { BullListing } from '../../../core/models/bull-listing.model';
import { Breed } from '../../../core/models/breed.model';
import { ProductCardComponent } from './product-card.component';
import { BullListingCardComponent } from '../../../shared/components/bull-listing-card/bull-listing-card.component';
import { BreedFilterComponent } from '../../../shared/components/breed-filter/breed-filter.component';

/**
 * Genética e insumos son unidades distintas —un toro agrupa varias pajillas, un
 * insumo es un producto suelto—, así que cada pestaña tiene su consulta, su
 * `count` y su paginación. Mezclarlas obligaría a repartir a mano los elementos
 * de cada página entre dos consultas paginadas.
 */
export type CatalogSection = 'GENETICS' | 'SUPPLIES';

/** Un parámetro ausente o no numérico deja el filtro sin aplicar. */
function toNumberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, ProductCardComponent, BullListingCardComponent, BreedFilterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
})
export default class CatalogComponent implements OnInit {
  private productService = inject(ProductService);
  private breedService = inject(BreedService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

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

    // La URL es la fuente de verdad y este es el **único** punto de carga: la
    // interfaz navega, la suscripción aplica y consulta. Un flujo en una sola
    // dirección evita cargar dos veces y hace que el enlace sea compartible,
    // que atrás deshaga filtros y que recargar conserve la vista.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.section.set(q.get('section') === 'supplies' ? 'SUPPLIES' : 'GENETICS');
      this.selectedBreed.set(q.get('breed') ?? '');
      this.minPrice.set(toNumberOrNull(q.get('min')));
      this.maxPrice.set(toNumberOrNull(q.get('max')));
      this.currentPage.set(Number(q.get('page')) || 1);
      this.load();
    });
  }

  /** Cambia de pestaña conservando el precio; la raza no aplica a insumos. */
  selectSection(section: CatalogSection): void {
    if (this.section() === section) return;
    this.navigateWithParams({
      section,
      breed: section === 'SUPPLIES' ? '' : this.selectedBreed(),
      page: 1,
    });
  }

  /** Escribe el estado en la URL; la suscripción se encarga de recargar. */
  private navigateWithParams(overrides: {
    section?: CatalogSection;
    breed?: string;
    min?: number | null;
    max?: number | null;
    page?: number;
  }): void {
    const section = overrides.section ?? this.section();
    const breed = overrides.breed ?? this.selectedBreed();
    const min = overrides.min !== undefined ? overrides.min : this.minPrice();
    const max = overrides.max !== undefined ? overrides.max : this.maxPrice();
    const page = overrides.page ?? this.currentPage();

    // Solo los valores que dicen algo, para no arrastrar `?breed=&min=&page=1`.
    const queryParams: Record<string, string | number> = {};
    if (section === 'SUPPLIES') queryParams['section'] = 'supplies';
    if (breed) queryParams['breed'] = breed;
    if (min != null) queryParams['min'] = min;
    if (max != null) queryParams['max'] = max;
    if (page > 1) queryParams['page'] = page;

    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.isGenetics() ? this.loadBulls() : this.loadSupplies();
  }

  private loadBulls(): void {
    this.productService
      .getCatalogBulls(this.currentPage(), this.limit, {
        breedSlug: this.selectedBreed() || undefined,
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
    this.navigateWithParams({ page: 1 });
  }

  clearFilters(): void {
    this.navigateWithParams({ breed: '', min: null, max: null, page: 1 });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.navigateWithParams({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }
}
