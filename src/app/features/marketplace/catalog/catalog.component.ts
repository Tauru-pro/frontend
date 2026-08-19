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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { BreedService } from '../../../core/services/breed.service';
import { Product } from '../../../core/models/product.model';
import { BullListing } from '../../../core/models/bull-listing.model';
import { Breed } from '../../../core/models/breed.model';
import { ProductCardComponent } from './product-card.component';
import { BullListingCardComponent } from '../../../shared/components/bull-listing-card/bull-listing-card.component';
import { BreedFilterComponent } from '../../../shared/components/breed-filter/breed-filter.component';
import { formatPrice } from '../../../shared/pipes/price.pipe';
import { sanitizeSearchTerm } from '../../../shared/utils/search-term';

/**
 * Genética e insumos son unidades distintas —un toro agrupa varias pajillas, un
 * insumo es un producto suelto—, así que cada pestaña tiene su consulta, su
 * `count` y su paginación. Mezclarlas obligaría a repartir a mano los elementos
 * de cada página entre dos consultas paginadas.
 */
export type CatalogSection = 'GENETICS' | 'SUPPLIES';

/** Un tramo de precio de los que se ofrecen como atajo. */
export interface PriceBand {
  label: string;
  min: number | null;
  max: number | null;
}

/**
 * Redondea a una cifra legible según la magnitud del rango: con 5.000 de ancho
 * los cortes van a miles, con 500.000 a cienmiles. Evita tramos como "$ 31.667".
 */
function niceRound(value: number, span: number): number {
  const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(Math.max(span, 1)))));
  return Math.round(value / step) * step;
}

/** Un parámetro ausente o no numérico deja el filtro sin aplicar. */
function toNumberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

@Component({
  selector: 'app-catalog',
  imports: [
    FormsModule,
    RouterLink,
    ProductCardComponent,
    BullListingCardComponent,
    BreedFilterComponent,
  ],
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
  search = signal<string>('');
  // Aplicado: el reflejo de la URL.
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  // Borrador: lo que hay escrito en los campos y aún no se ha aplicado. Vive
  // aparte porque, si compartiera señal con lo aplicado, "Limpiar" no podría
  // vaciarlo cuando la navegación no llega a cambiar la URL.
  draftMin = signal<number | null>(null);
  draftMax = signal<number | null>(null);

  priceBounds = signal<{ min: number; max: number } | null>(null);

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

  /**
   * Tres tramos derivados de los precios reales. Sin resultados, o con un solo
   * precio en el catálogo, no hay nada que partir y no se ofrece ninguno.
   */
  priceBands = computed<PriceBand[]>(() => {
    const bounds = this.priceBounds();
    if (!bounds || bounds.max <= bounds.min) return [];
    const span = bounds.max - bounds.min;
    const low = niceRound(bounds.min + span / 3, span);
    const high = niceRound(bounds.min + (span * 2) / 3, span);
    if (low >= high) return [];
    return [
      { label: `Hasta ${formatPrice(low)}`, min: null, max: low },
      { label: `${formatPrice(low)} a ${formatPrice(high)}`, min: low, max: high },
      { label: `Más de ${formatPrice(high)}`, min: high, max: null },
    ];
  });

  hasActiveFilters = computed(
    () =>
      !!this.selectedBreed() ||
      this.minPrice() != null ||
      this.maxPrice() != null ||
      !!this.search(),
  );

  /** Un rango invertido devuelve cero resultados sin explicar por qué. */
  canApplyPrice = computed(() => {
    const min = this.draftMin();
    const max = this.draftMax();
    if (min == null && max == null) return false;
    return min == null || max == null || min <= max;
  });

  readonly limit = 12;
  /** Tantos esqueletos como resultados va a traer la página, para no reflowear. */
  readonly skeletons = Array.from({ length: 12 });

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
      // Saneado también acá, no solo en el navbar: la URL es editable a mano.
      this.search.set(sanitizeSearchTerm(q.get('q') ?? '').trim());
      this.minPrice.set(toNumberOrNull(q.get('min')));
      this.maxPrice.set(toNumberOrNull(q.get('max')));
      this.draftMin.set(this.minPrice());
      this.draftMax.set(this.maxPrice());
      this.currentPage.set(Number(q.get('page')) || 1);
      this.load();
      this.loadPriceBounds();
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
    search?: string;
    min?: number | null;
    max?: number | null;
    page?: number;
  }): void {
    const section = overrides.section ?? this.section();
    const breed = overrides.breed ?? this.selectedBreed();
    const search = overrides.search ?? this.search();
    const min = overrides.min !== undefined ? overrides.min : this.minPrice();
    const max = overrides.max !== undefined ? overrides.max : this.maxPrice();
    const page = overrides.page ?? this.currentPage();

    // Solo los valores que dicen algo, para no arrastrar `?breed=&min=&page=1`.
    const queryParams: Record<string, string | number> = {};
    if (section === 'SUPPLIES') queryParams['section'] = 'supplies';
    if (breed) queryParams['breed'] = breed;
    if (search) queryParams['q'] = search;
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
        search: this.search() || undefined,
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
        search: this.search() || undefined,
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

  /** Aplica el rango escrito en los campos. */
  applyPrice(): void {
    if (!this.canApplyPrice()) return;
    this.navigateWithParams({ min: this.draftMin(), max: this.draftMax(), page: 1 });
  }

  /**
   * Resetea el borrador aquí mismo en vez de esperar a la suscripción: si la
   * URL de destino coincide con la actual, Angular ignora la navegación y
   * `queryParamMap` nunca reemite, así que el campo se quedaría escrito.
   */
  clearFilters(): void {
    this.draftMin.set(null);
    this.draftMax.set(null);
    this.navigateWithParams({ breed: '', search: '', min: null, max: null, page: 1 });
  }

  /** Los tramos relevantes son los de lo que se está viendo. */
  private loadPriceBounds(): void {
    if (!this.isGenetics()) {
      this.priceBounds.set(null);
      return;
    }
    this.productService.getCatalogPriceBounds(this.selectedBreed() || undefined).subscribe({
      next: (bounds) => this.priceBounds.set(bounds),
      error: () => this.priceBounds.set(null),
    });
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
