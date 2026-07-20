import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, ProductType, STRAW_LABELS } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';

const TYPE_LABELS: Record<ProductType, string> = {
  STRAW: 'Pajilla',
  SUPPLIES: 'Insumo',
};

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden group flex flex-col h-full">

      <!-- Image -->
      <div class="relative bg-surface-muted h-48 flex items-center justify-center overflow-hidden flex-shrink-0">
        @if (coverUrl()) {
          <img [src]="coverUrl()!" [alt]="product().name"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        } @else {
          <span class="text-7xl select-none group-hover:scale-110 transition-transform duration-300">
            {{ product().productType === 'STRAW' ? '🧫' : '📦' }}
          </span>
        }

        <!-- Type badge -->
        <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
          [class]="product().productType === 'STRAW' ? 'bg-primary text-white' : 'bg-accent text-white'">
          {{ typeLabel() }}
        </span>

        <!-- Stock badge -->
        @if (product().stockQuantity === 0) {
          <span class="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
            Agotado
          </span>
        }
      </div>

      <!-- Body -->
      <div class="p-4 flex flex-col flex-1 gap-2">
        <div>
          <h3 class="text-sm font-bold text-primary leading-tight line-clamp-2 mb-0.5">{{ product().name }}</h3>
          @if (product().productType === 'STRAW') {
            <p class="text-xs text-gray-400">{{ product().bull?.breedName ?? product().bull?.name ?? '—' }}</p>
            @if (product().strawType) {
              <span class="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {{ strawLabel() }}
              </span>
            }
          } @else {
            <p class="text-xs text-gray-400">Insumo</p>
          }
        </div>

        <div class="mt-auto pt-2 flex items-center justify-between">
          <span class="text-sm font-bold text-secondary">\${{ product().price.toFixed(2) }}</span>
          <a [routerLink]="['/catalog', product().id]"
            class="text-xs btn-primary-outline py-1.5 px-3 rounded-lg font-medium">
            Ver detalle
          </a>
        </div>
      </div>
    </div>
  `,
})
export class ProductCardComponent {
  product = input.required<Product>();

  private productService = inject(ProductService);

  coverUrl = computed(() => {
    const cover =
      this.product().media.find((m) => m.isCover && m.mediaType === 'image') ??
      this.product().media.find((m) => m.mediaType === 'image');
    return cover ? this.productService.getMediaPublicUrl(cover.storagePath) : null;
  });

  typeLabel = computed(() => TYPE_LABELS[this.product().productType]);

  strawLabel = computed(() => {
    const t = this.product().strawType;
    return t ? STRAW_LABELS[t] : '';
  });
}
