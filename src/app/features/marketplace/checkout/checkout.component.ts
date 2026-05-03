import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CartStore } from '../../../core/store/cart.store';
import { environment } from '../../../../environments/environment';
import { BullMedia, StrawType } from '../../../core/models/bull.model';

type ShippingMethod = 'standard' | 'express' | 'pickup';

const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado ♂',
  SEXADO_FEMALE: 'Sexado ♀',
};

const SHIPPING_OPTIONS: { id: ShippingMethod; label: string; detail: string; cost: number }[] = [
  { id: 'standard', label: 'Envío Estándar', detail: '5–8 días hábiles · Cadena de frío básica', cost: 15 },
  { id: 'express', label: 'Envío Express', detail: '1–3 días hábiles · Cadena de frío garantizada', cost: 30 },
  { id: 'pickup', label: 'Recogida en Punto', detail: 'Retira en nuestro centro de distribución', cost: 0 },
];

@Component({
  selector: 'app-checkout',
  standalone: true,
  host: {
    class: 'w-full'
  },
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.component.html',
})
export default class CheckoutComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  cartStore = inject(CartStore);

  // Steps: 1=Información, 2=Envío, 3=Pago, 4=Confirmado
  currentStep = signal<1 | 2 | 3 | 4>(1);
  stepError = signal<string | null>(null);
  submitting = signal(false);

  // Step 1 fields
  fullName = signal('');
  email = signal('');
  phone = signal('');
  city = signal('');
  address = signal('');

  // Step 2
  shippingMethod = signal<ShippingMethod>('standard');

  // Discount (decorative)
  discountCode = signal('');

  readonly shippingOptions = SHIPPING_OPTIONS;

  shippingCost = computed(
    () => SHIPPING_OPTIONS.find((o) => o.id === this.shippingMethod())?.cost ?? 15
  );

  grandTotal = computed(() => this.cartStore.total() + this.shippingCost());

  selectedShippingOption = computed(
    () => SHIPPING_OPTIONS.find((o) => o.id === this.shippingMethod())!
  );

  ngOnInit(): void {
    if (this.cartStore.items().length === 0) {
      this.router.navigate(['/carrito']);
    }
  }

  next(): void {
    this.stepError.set(null);
    if (this.currentStep() === 1) {
      if (!this.fullName().trim() || !this.email().trim() || !this.city().trim() || !this.address().trim()) {
        this.stepError.set('Por favor completa todos los campos requeridos.');
        return;
      }
    }
    this.currentStep.update((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
  }

  back(): void {
    this.stepError.set(null);
    if (this.currentStep() === 1) {
      this.router.navigate(['/carrito']);
    } else {
      this.currentStep.update((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
    }
  }

  async confirm(): Promise<void> {
    this.stepError.set(null);
    this.submitting.set(true);
    const items = this.cartStore.items();
    const dto = {
      items: items.map((i) => ({ productId: i.selectedStraw.id, quantity: i.quantity })),
      sellerId: items[0].bull.sellerId,
      shippingDept: this.city(),
      ...(this.shippingMethod() === 'pickup' ? {} : {}),
    };
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/orders`, dto)
      );
      await this.cartStore.clear();
      this.currentStep.set(4);
    } catch {
      this.stepError.set('No se pudo crear la orden. Por favor intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  coverUrl(media: BullMedia[]): string | null {
    const cover = media.find((m) => m.isCover && m.mediaType === 'image')
      ?? media.find((m) => m.mediaType === 'image');
    return cover ? `${environment.cdn}/${cover.s3Key}` : null;
  }

  strawLabel(type: StrawType): string {
    return STRAW_LABELS[type];
  }

  itemTotal(price: number, qty: number): string {
    return (price * qty).toFixed(2);
  }
}
