import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../../core/store/cart.store';
import { StrawType } from '../../../core/models/bull.model';
import { S3fileUrlPipe } from '../../../shared/pipes/s3fileUrl-pipe';

const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado ♂',
  SEXADO_FEMALE: 'Sexado ♀',
};

@Component({
  selector: 'app-cart',
  standalone: true,
  host: {
    class: 'w-full'
  },
  imports: [RouterLink, S3fileUrlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.component.html',
})
export default class CartComponent {
  cartStore = inject(CartStore);

  shipping = 15.00;

  grandTotal = computed(() => this.cartStore.total() + (this.cartStore.count() > 0 ? this.shipping : 0));

  strawLabel(type: StrawType): string {
    return STRAW_LABELS[type];
  }

  increment(bullId: string, strawId: string, current: number): void {
    this.cartStore.updateQuantity(bullId, strawId, current + 1);
  }

  decrement(bullId: string, strawId: string, current: number): void {
    if (current <= 1) {
      this.cartStore.removeItem(bullId, strawId);
    } else {
      this.cartStore.updateQuantity(bullId, strawId, current - 1);
    }
  }

  remove(bullId: string, strawId: string): void {
    this.cartStore.removeItem(bullId, strawId);
  }

  itemSubtotal(price: number, qty: number): number {
    return price * qty;
  }
}
