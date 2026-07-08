import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../../core/store/cart.store';
import { ProductType, StrawType } from '../../../core/models/product.model';

const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado ♂',
  SEXADO_FEMALE: 'Sexado ♀',
};

const TYPE_LABELS: Record<ProductType, string> = {
  STRAW: 'Pajilla',
  SUPPLIES: 'Insumo',
};

@Component({
  selector: 'app-cart',
  standalone: true,
  host: { class: 'w-full' },
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.component.html',
})
export default class CartComponent {
  cartStore = inject(CartStore);

  grandTotal = computed(() => this.cartStore.total());

  productTypeLabel(type: ProductType): string {
    return TYPE_LABELS[type];
  }

  strawLabel(type: StrawType | null): string {
    return type ? STRAW_LABELS[type] : '';
  }

  increment(productId: string, current: number): void {
    this.cartStore.updateQuantity(productId, current + 1);
  }

  decrement(productId: string, current: number, min: number): void {
    if (current <= min) {
      this.cartStore.removeItem(productId);
    } else {
      this.cartStore.updateQuantity(productId, current - 1);
    }
  }

  remove(productId: string): void {
    this.cartStore.removeItem(productId);
  }

  itemSubtotal(price: number, qty: number): number {
    return price * qty;
  }
}
