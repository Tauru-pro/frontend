import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CartStore } from '../../../core/store/cart.store';
import { PickupPointService } from '../../../core/services/pickup-point.service';
import { PickupPoint } from '../../../core/models/pickup-point.model';
import { ProductType, StrawType } from '../../../core/models/product.model';
import { LocationSelectComponent, LocationSelection } from '../../../shared/components/location-select/location-select.component';
import { OrderService } from '../../../core/services/order.service';

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
  selector: 'app-checkout',
  standalone: true,
  host: { class: 'w-full' },
  imports: [RouterLink, FormsModule, LocationSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.component.html',
})
export default class CheckoutComponent implements OnInit {
  private router = inject(Router);
  private orderService = inject(OrderService);
  private pickupPointService = inject(PickupPointService);
  cartStore = inject(CartStore);

  currentStep = signal<1 | 2>(1);
  stepError = signal<string | null>(null);
  submitting = signal(false);

  // Step 1 — contact info
  buyerFullName = signal('');
  buyerEmail = signal('');
  buyerPhone = signal('');
  buyerCity = signal('');
  buyerAddress = signal('');

  initialStateId = signal<string | null>(null);
  initialCityId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);
  showLocationErrors = signal(false);

  // Step 2 — pickup point
  pickupPoints = signal<PickupPoint[]>([]);
  pickupPointsLoading = signal(false);
  selectedPickupPointId = signal<string | null>(null);
  notes = signal('');

  shippingCost = signal<number | null>(null);
  shippingCostLoading = signal(false);

  selectedPickupPoint = computed(() =>
    this.pickupPoints().find((p) => p.id === this.selectedPickupPointId()) ?? null
  );

  grandTotal = computed(() => {
    const cost = this.shippingCost();
    return cost !== null ? this.cartStore.total() + cost : this.cartStore.total();
  });

  ngOnInit(): void {
    if (this.cartStore.items().length === 0) {
      this.router.navigate(['/carrito']);
    }
  }

  next(): void {
    this.stepError.set(null);
    if (this.currentStep() === 1) {
      if (!this.buyerFullName().trim() || !this.buyerEmail().trim()) {
        this.stepError.set('Por favor completa los campos requeridos.');
        return;
      }
      if (!this.selectedCityId()) {
        this.showLocationErrors.set(true);
        this.stepError.set('Por favor selecciona tu departamento y municipio.');
        return;
      }
    }
    this.currentStep.set(2);
  }

  back(): void {
    this.stepError.set(null);
    if (this.currentStep() === 1) {
      this.router.navigate(['/carrito']);
    } else {
      this.currentStep.set(1);
    }
  }

  onLocationChange(selection: LocationSelection | null): void {
    this.selectedCityId.set(selection?.cityId ?? null);
    this.buyerCity.set(selection?.cityId ?? '');

    const stateId = selection?.stateId ?? null;
    this.pickupPoints.set([]);
    this.selectedPickupPointId.set(null);
    this.shippingCost.set(null);

    if (stateId) {
      this.pickupPointsLoading.set(true);
      this.pickupPointService.getByDepartment(stateId).subscribe({
        next: (points) => {
          this.pickupPoints.set(points);
          this.pickupPointsLoading.set(false);
        },
        error: () => this.pickupPointsLoading.set(false),
      });
    }
  }

  selectPickupPoint(id: string): void {
    this.selectedPickupPointId.set(id);
    this.stepError.set(null);
    this.shippingCost.set(null);
    this.shippingCostLoading.set(true);
    this.orderService.getShippingEstimate(id).subscribe({
      next: (res) => {
        this.shippingCost.set(res.totalShipping);
        this.shippingCostLoading.set(false);
      },
      error: () => this.shippingCostLoading.set(false),
    });
  }

  async confirm(): Promise<void> {
    if (!this.selectedPickupPointId()) {
      this.stepError.set('Por favor selecciona un punto de recogida.');
      return;
    }
    this.stepError.set(null);
    this.submitting.set(true);
    try {
      const items = this.cartStore.items().map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      }));
      const order = await firstValueFrom(
        this.orderService.checkoutFromCart({
          buyerFullName: this.buyerFullName(),
          buyerEmail: this.buyerEmail(),
          buyerPhone: this.buyerPhone() || undefined,
          buyerCity: this.buyerCity() || undefined,
          buyerAddress: this.buyerAddress() || undefined,
          pickupPointId: this.selectedPickupPointId()!,
          notes: this.notes() || undefined,
          items,
        } as any)
      );
      this.cartStore.clear();
      window.location.href = order.paymentUrl;
    } catch {
      this.stepError.set('No se pudo crear la orden. Por favor intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  productTypeLabel(type: ProductType): string {
    return TYPE_LABELS[type];
  }

  strawLabel(type: StrawType | null): string {
    return type ? STRAW_LABELS[type] : '';
  }

  itemTotal(price: number, qty: number): string {
    return (price * qty).toFixed(2);
  }
}
