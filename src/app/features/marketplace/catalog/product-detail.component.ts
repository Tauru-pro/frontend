import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartStore } from '../../../core/store/cart.store';
import { Product, ProductMedia, StrawType, STRAW_LABELS } from '../../../core/models/product.model';
import { PricePipe } from '../../../shared/pipes/price.pipe';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Breadcrumb -->
    <div class="max-w-5xl mx-auto px-4 py-4">
      <nav class="flex items-center gap-2 text-xs text-gray-400">
        <a routerLink="/" class="hover:text-secondary transition-colors">Inicio</a>
        <span>›</span>
        <a routerLink="/catalog" class="hover:text-secondary transition-colors">Catálogo</a>
        <span>›</span>
        <span class="text-primary font-medium">{{ product()?.name ?? 'Producto' }}</span>
      </nav>
    </div>

    <div class="max-w-5xl mx-auto px-4 pb-14">

      <!-- Loading -->
      @if (loading()) {
        <div class="grid md:grid-cols-2 gap-10 animate-pulse">
          <div class="bg-surface-muted rounded-2xl h-96"></div>
          <div class="space-y-4 pt-4">
            <div class="h-6 bg-gray-100 rounded w-3/4"></div>
            <div class="h-4 bg-gray-100 rounded w-1/2"></div>
            <div class="h-10 bg-gray-100 rounded w-1/3 mt-6"></div>
            <div class="h-12 bg-gray-100 rounded mt-4"></div>
          </div>
        </div>
      }

      <!-- Error / not found -->
      @if (!loading() && (error() || !product())) {
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <span class="text-6xl mb-4">🔍</span>
          <h2 class="text-xl font-bold text-primary mb-2">Producto no encontrado</h2>
          <p class="text-gray-400 text-sm mb-6">Este producto no está disponible o ya no se encuentra en el catálogo.</p>
          <a routerLink="/catalog" class="btn-primary px-8 py-3 text-sm">Volver al catálogo</a>
        </div>
      }

      <!-- Product detail -->
      @if (!loading() && product(); as p) {
        <div class="grid md:grid-cols-2 gap-10">

          <!-- ── Gallery ── -->
          <div class="space-y-3">
            <!-- Main image -->
            <div class="relative bg-surface-muted rounded-2xl overflow-hidden h-80 md:h-96 flex items-center justify-center">
              @if (activeImageUrl()) {
                <img [src]="activeImageUrl()!" [alt]="p.name" class="w-full h-full object-cover" />
              } @else {
                <span class="text-8xl">{{ p.productType === 'STRAW' ? '🧫' : '📦' }}</span>
              }
              <!-- Out-of-stock overlay -->
              @if (p.stockQuantity === 0) {
                <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span class="text-white font-bold text-lg tracking-wide">Agotado</span>
                </div>
              }
            </div>

            <!-- Thumbnail strip -->
            @if (images().length > 1) {
              <div class="flex gap-2 overflow-x-auto pb-1">
                @for (img of images(); track img.id) {
                  <button (click)="selectImage(img)"
                    class="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors"
                    [class]="activeImageUrl() === mediaUrl(img.storagePath) ? 'border-secondary' : 'border-gray-200 hover:border-gray-400'">
                    <img [src]="mediaUrl(img.storagePath)" [alt]="p.name" class="w-full h-full object-cover" />
                  </button>
                }
              </div>
            }
          </div>

          <!-- ── Info ── -->
          <div class="flex flex-col gap-4 pt-2">
            <!-- Name & badges -->
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  [class]="p.productType === 'STRAW' ? 'bg-primary text-white' : 'bg-accent text-white'">
                  {{ p.productType === 'STRAW' ? 'Pajilla' : 'Insumo' }}
                </span>
                @if (p.stockQuantity > 0) {
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    En stock ({{ p.stockQuantity }})
                  </span>
                } @else {
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    Agotado
                  </span>
                }
              </div>
              <h1 class="text-2xl font-bold text-primary leading-tight">{{ p.name }}</h1>
              @if (p.productType === 'STRAW' && p.bull) {
                <p class="text-sm text-gray-400 mt-1">
                  Toro: <span class="font-semibold text-gray-600">{{ p.bull.name }}</span>
                  @if (p.bull.breedName) { · <span class="text-gray-500">{{ p.bull.breedName }}</span> }
                </p>
              }
              @if (variants().length > 1) {
                <div class="mt-3">
                  <p class="text-xs font-semibold text-gray-500 mb-1.5">Tipo de pajilla</p>
                  <div class="flex flex-wrap gap-2">
                    @for (v of variants(); track v.id) {
                      <button type="button" (click)="selectVariant(v)"
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                        [class]="v.id === p.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                        {{ strawLabel(v.strawType!) }}
                      </button>
                    }
                  </div>
                </div>
              } @else if (p.strawType) {
                <span class="inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {{ strawLabel(p.strawType) }}
                </span>
              }
            </div>

            <!-- Price -->
            <div class="py-3 border-t border-b border-gray-100">
              <span class="text-3xl font-bold text-secondary">{{ p.price | price }}</span>
              <span class="text-sm text-gray-400 ml-1">por unidad</span>
              @if (p.minOrderQuantity > 1) {
                <p class="text-xs text-gray-400 mt-0.5">Pedido mínimo: {{ p.minOrderQuantity }} unidades</p>
              }
            </div>

            <!-- Description -->
            @if (p.description) {
              <p class="text-sm text-gray-600 leading-relaxed">{{ p.description }}</p>
            }

            <!-- Quantity & cart -->
            <div class="space-y-3 mt-2">
              <div class="flex items-center gap-3">
                <label class="text-xs font-semibold text-gray-500">Cantidad</label>
                <div class="flex items-center gap-0">
                  <button (click)="decrement()"
                    class="w-9 h-9 rounded-l-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-surface hover:text-primary transition-colors text-lg font-medium">
                    −
                  </button>
                  <span class="w-12 h-9 border-t border-b border-gray-200 flex items-center justify-center text-sm font-bold text-primary">
                    {{ quantity() }}
                  </span>
                  <button (click)="increment()"
                    class="w-9 h-9 rounded-r-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-surface hover:text-primary transition-colors text-lg font-medium">
                    +
                  </button>
                </div>
              </div>

              <button (click)="addToCart()"
                [disabled]="p.stockQuantity === 0 || addedToCart()"
                class="w-full btn-primary py-3.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                @if (addedToCart()) {
                  ✓ Agregado al carrito
                } @else if (p.stockQuantity === 0) {
                  Sin stock disponible
                } @else {
                  Agregar al carrito
                }
              </button>

              <a routerLink="/carrito" class="block w-full text-center btn-primary-outline py-3 text-sm">
                Ver carrito
              </a>
            </div>
          </div>
        </div>

        <!-- Video del toro -->
        @if (bullVideoUrl(); as videoUrl) {
          <section class="mt-10 pt-8 border-t border-gray-100">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">Video del toro</h2>
            <video
              [src]="videoUrl"
              controls
              preload="metadata"
              class="w-full max-h-[28rem] rounded-2xl bg-black"
            ></video>
          </section>
        }

        <!-- Prueba genética -->
        @if (bullDocumentUrl(); as docUrl) {
          <section class="mt-10 pt-8 border-t border-gray-100">
            <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información genética</h2>
              <!-- Siempre visible: en móvil el navegador casi nunca incrusta el PDF -->
              <a [href]="docUrl" target="_blank" rel="noopener"
                class="btn-primary-outline px-4 py-2 text-xs font-medium">
                Abrir prueba genética ↗
              </a>
            </div>
            <object
              [data]="bullDocumentSafeUrl()"
              type="application/pdf"
              class="w-full h-[28rem] rounded-2xl border border-gray-100 bg-surface-muted"
            >
              <div class="h-full flex flex-col items-center justify-center text-center px-6">
                <span class="text-4xl mb-3 select-none">📄</span>
                <p class="text-sm text-gray-500">
                  Tu navegador no puede mostrar el PDF aquí. Usa el botón para abrirlo.
                </p>
              </div>
            </object>
          </section>
        }

        <!-- Back link -->
        <div class="mt-10 pt-6 border-t border-gray-100">
          <a routerLink="/catalog" class="text-sm text-gray-400 hover:text-primary transition-colors flex items-center gap-1.5">
            ← Volver al catálogo
          </a>
        </div>
      }
    </div>
  `,
})
export default class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartStore = inject(CartStore);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  product = signal<Product | null>(null);
  variants = signal<Product[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  activeImageUrl = signal<string | null>(null);
  quantity = signal(1);
  addedToCart = signal(false);

  images = computed<ProductMedia[]>(() =>
    (this.product()?.media ?? []).filter((m) => m.mediaType === 'image')
  );

  // getProduct() trae la media del producto y la de su toro; el vídeo y el PDF
  // son siempre del toro.
  private bullMedia = computed<ProductMedia[]>(() =>
    (this.product()?.media ?? []).filter((m) => m.entityType === 'bull')
  );

  bullVideoUrl = computed<string | null>(() => {
    const video = this.bullMedia().find((m) => m.mediaType === 'video');
    return video ? this.mediaUrl(video.storagePath) : null;
  });

  bullDocumentUrl = computed<string | null>(() => {
    const doc = this.bullMedia().find((m) => m.mediaType === 'document');
    return doc ? this.mediaUrl(doc.storagePath) : null;
  });

  /**
   * Angular bloquea las URL en `[data]` de `<object>`. Es seguro desarmarlo
   * aquí: la URL la compone `getMediaPublicUrl()` a partir del `storage_path`
   * de nuestro propio bucket, no de una entrada del usuario.
   */
  bullDocumentSafeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.bullDocumentUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  ngOnInit(): void {
    // Cambiar de variante navega a otra ficha del mismo componente, así que hay
    // que reaccionar al parámetro: con `snapshot` la página no se recargaría.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.loading.set(false);
        return;
      }
      this.loadProduct(id);
    });
  }

  private loadProduct(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.product.set(null);
    this.variants.set([]);
    this.activeImageUrl.set(null);
    this.addedToCart.set(false);
    this.quantity.set(1);

    this.productService.getProduct(id).subscribe({
      next: (p) => {
        if (p.status !== 'ACTIVE') {
          this.loading.set(false);
          return;
        }
        this.product.set(p);
        this.quantity.set(p.minOrderQuantity);
        const cover =
          p.media.find((m) => m.isCover && m.mediaType === 'image') ??
          p.media.find((m) => m.mediaType === 'image');
        if (cover) this.activeImageUrl.set(this.mediaUrl(cover.storagePath));
        this.loading.set(false);

        if (p.productType === 'STRAW' && p.bull) this.loadVariants(p.bull.id);
      },
      error: () => {
        this.error.set('No se pudo cargar el producto.');
        this.loading.set(false);
      },
    });
  }

  /** Solo las aprobadas: el vendedor no debe ver sus borradores como comprables. */
  private loadVariants(bullId: string): void {
    this.productService.getStrawProductsByBull(bullId, true).subscribe({
      next: (straws) => this.variants.set(straws.filter((s) => s.strawType)),
      error: () => this.variants.set([]),
    });
  }

  selectVariant(variant: Product): void {
    if (variant.id === this.product()?.id) return;
    this.router.navigate(['/catalog', variant.id]);
  }

  mediaUrl(storagePath: string): string {
    return this.productService.getMediaPublicUrl(storagePath);
  }

  selectImage(media: ProductMedia): void {
    this.activeImageUrl.set(this.mediaUrl(media.storagePath));
  }

  strawLabel(type: StrawType): string {
    return STRAW_LABELS[type];
  }

  increment(): void {
    this.quantity.update((q) => q + 1);
  }

  decrement(): void {
    const min = this.product()?.minOrderQuantity ?? 1;
    this.quantity.update((q) => Math.max(min, q - 1));
  }

  addToCart(): void {
    const p = this.product();
    if (!p || p.stockQuantity === 0) return;
    this.cartStore.addItem(p, this.quantity());
    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}
