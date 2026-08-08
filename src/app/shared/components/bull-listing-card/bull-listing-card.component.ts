import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BullListing, BullListingVariant } from '../../../core/models/bull-listing.model';
import { STRAW_LABELS } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';
import { CartStore } from '../../../core/store/cart.store';

@Component({
  selector: 'app-bull-listing-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-all overflow-hidden group flex flex-col h-full">

      <!-- Imagen -->
      <a [routerLink]="['/catalog', selected().id]" class="block bg-surface-muted h-40 flex items-center justify-center overflow-hidden flex-shrink-0">
        @if (item().coverUrl) {
          <img
            [src]="item().coverUrl!"
            [alt]="item().bullName"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        } @else {
          <span class="text-6xl select-none group-hover:scale-110 transition-transform duration-300">🧫</span>
        }
      </a>

      <div class="p-4 flex flex-col flex-1 gap-2 border-t border-gray-100">

        <!-- Vendedor -->
        <p class="text-xs text-gray-400">Por {{ item().sellerName }}</p>

        <!-- Toro y raza -->
        <a [routerLink]="['/catalog', selected().id]" class="hover:underline">
          <h3 class="text-sm font-bold text-primary leading-tight line-clamp-2">{{ item().bullName }}</h3>
        </a>
        @if (item().breedName) {
          <p class="text-xs text-gray-400 -mt-1">{{ item().breedName }}</p>
        }

        <!-- Precio de la variante seleccionada -->
        <p class="text-xl font-bold text-primary mt-1">{{ formatPrice(selected().price) }}</p>

        <!-- Variantes: los tipos de pajilla aprobados del toro -->
        @if (item().straws.length > 1) {
          <div class="flex flex-wrap gap-1.5">
            @for (variant of item().straws; track variant.id) {
              <button
                type="button"
                (click)="select(variant)"
                [class]="'px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ' +
                  (variant.id === selected().id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300')"
              >
                {{ strawLabel(variant) }}
              </button>
            }
          </div>
        } @else {
          <span class="self-start px-2 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary">
            {{ strawLabel(selected()) }}
          </span>
        }

        @if (outOfStock()) {
          <p class="text-[11px] font-medium text-red-500">Agotado</p>
        }

        <button
          type="button"
          (click)="add()"
          [disabled]="outOfStock() || adding()"
          class="w-full btn-primary py-2 text-sm mt-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ adding() ? 'Agregando…' : 'Agregar' }}
        </button>
      </div>
    </div>
  `,
})
export class BullListingCardComponent {
  item = input.required<BullListing>();

  private productService = inject(ProductService);
  private cartStore = inject(CartStore);

  private chosenId = signal<string | null>(null);
  adding = signal(false);

  /** La variante elegida, o la primera (la más barata: la vista las ordena por precio). */
  selected = computed<BullListingVariant>(() => {
    const straws = this.item().straws;
    return straws.find((s) => s.id === this.chosenId()) ?? straws[0];
  });

  outOfStock = computed(() => this.selected().stockQuantity === 0);

  select(variant: BullListingVariant): void {
    this.chosenId.set(variant.id);
  }

  strawLabel(variant: BullListingVariant): string {
    return variant.strawType ? STRAW_LABELS[variant.strawType] : 'Pajilla';
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * La vista de destacados solo trae los campos que pinta la tarjeta, y el
   * carrito guarda el `Product` entero (lo persiste y lo repinta en /carrito),
   * así que se resuelve el producto completo antes de añadirlo.
   */
  async add(): Promise<void> {
    const variant = this.selected();
    if (variant.stockQuantity === 0) return;
    this.adding.set(true);
    try {
      const product = await firstValueFrom(this.productService.getProduct(variant.id));
      this.cartStore.addItem(product, variant.minOrderQuantity);
    } catch {
      /* el carrito ya muestra sus propios errores; no se bloquea la portada */
    } finally {
      this.adding.set(false);
    }
  }
}
