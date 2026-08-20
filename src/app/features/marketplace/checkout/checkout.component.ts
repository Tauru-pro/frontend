import {
  Component,
  signal,
  computed,
  effect,
  inject,
  OnInit,
  PLATFORM_ID,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartStore } from '../../../core/store/cart.store';
import { PickupPointService } from '../../../core/services/pickup-point.service';
import { PickupPoint } from '../../../core/models/pickup-point.model';
import { Product, ProductType, StrawType } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UserStore } from '../../../core/store/user.store';
import { LocationSelectComponent, LocationSelection } from '../../../shared/components/location-select/location-select.component';
import {
  PhoneInputComponent,
  PhoneValue,
} from '../../../shared/components/phone-input/phone-input.component';
import { PricePipe } from '../../../shared/pipes/price.pipe';
import { OrderService } from '../../../core/services/order.service';
import { WompiCheckoutService } from '../../../core/services/wompi-checkout.service';
import { CheckoutCartItem } from '../../../core/models/order.model';

const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado ♂',
  SEXADO_FEMALE: 'Sexado ♀',
};

const TYPE_LABELS: Record<ProductType, string> = {
  STRAW: 'Pajilla',
  SUPPLIES: 'Insumo',
};

const CHECKOUT_STORAGE_KEY = 'tauru_checkout_form';

/**
 * Lo justo para sobrevivir una recarga de página en medio del checkout — no
 * la lista de puntos de recogida ni el costo de envío, que se vuelven a pedir.
 */
interface CheckoutFormState {
  currentStep: 1 | 2;
  buyerFullName: string;
  buyerEmail: string;
  buyerPhone: string;
  prefillPhoneNumber: string;
  prefillPhoneCode: string | null;
  selectedCityId: string | null;
  buyerAddress: string;
  notes: string;
  selectedPickupPointId: string | null;
  /** Reused across retries/refreshes of the same checkout attempt so create-checkout can dedupe (design.md Decision 3). */
  idempotencyKey: string | null;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  host: { class: 'w-full' },
  imports: [RouterLink, FormsModule, LocationSelectComponent, PhoneInputComponent, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.component.html',
})
export default class CheckoutComponent implements OnInit {
  private router = inject(Router);
  private orderService = inject(OrderService);
  private wompiCheckout = inject(WompiCheckoutService);
  private pickupPointService = inject(PickupPointService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private userStore = inject(UserStore);
  private platformId = inject(PLATFORM_ID);
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

  // Seed values for the child inputs — the live signals above are what's
  // actually submitted; app-phone-input/app-location-select only report
  // changes on user interaction, so precarga needs both (see onInit).
  prefillPhoneNumber = signal('');
  prefillPhoneCode = signal<string | null>(null);
  initialCityId = signal<string | null>(null);

  selectedCityId = signal<string | null>(null);
  showLocationErrors = signal(false);
  showContactErrors = signal(false);

  /** Punto de recogida a re-seleccionar apenas lleguen los puntos del departamento restaurado — se consume una sola vez. */
  private pendingRestoredPickupPointId: string | null = null;

  // Step 2 — pickup point
  pickupPoints = signal<PickupPoint[]>([]);
  pickupPointsLoading = signal(false);
  selectedPickupPointId = signal<string | null>(null);
  notes = signal('');

  shippingCost = signal<number | null>(null);
  shippingCostLoading = signal(false);

  idempotencyKey = signal<string | null>(null);

  selectedPickupPoint = computed(() =>
    this.pickupPoints().find((p) => p.id === this.selectedPickupPointId()) ?? null
  );

  grandTotal = computed(() => {
    const cost = this.shippingCost();
    return cost !== null ? this.cartStore.total() + cost : this.cartStore.total();
  });

  constructor() {
    // Autoguardado: cualquier cambio en estos signals reescribe sessionStorage,
    // sin tener que acordarse de llamar "guardar" en cada handler.
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const state: CheckoutFormState = {
          currentStep: this.currentStep(),
          buyerFullName: this.buyerFullName(),
          buyerEmail: this.buyerEmail(),
          buyerPhone: this.buyerPhone(),
          prefillPhoneNumber: this.prefillPhoneNumber(),
          prefillPhoneCode: this.prefillPhoneCode(),
          selectedCityId: this.selectedCityId(),
          buyerAddress: this.buyerAddress(),
          notes: this.notes(),
          selectedPickupPointId: this.selectedPickupPointId(),
          idempotencyKey: this.idempotencyKey(),
        };
        sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(state));
      });
    }
  }

  /** @returns true si había un formulario guardado y se restauró. */
  private restoreState(): boolean {
    const raw = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!raw) return false;
    try {
      const state = JSON.parse(raw) as CheckoutFormState;
      this.buyerFullName.set(state.buyerFullName ?? '');
      this.buyerEmail.set(state.buyerEmail ?? '');
      this.buyerPhone.set(state.buyerPhone ?? '');
      this.prefillPhoneNumber.set(state.prefillPhoneNumber ?? '');
      this.prefillPhoneCode.set(state.prefillPhoneCode ?? null);
      this.buyerAddress.set(state.buyerAddress ?? '');
      this.notes.set(state.notes ?? '');
      if (state.selectedCityId) {
        this.selectedCityId.set(state.selectedCityId);
        this.initialCityId.set(state.selectedCityId);
        this.buyerCity.set(state.selectedCityId);
      }
      this.pendingRestoredPickupPointId = state.selectedPickupPointId ?? null;
      this.idempotencyKey.set(state.idempotencyKey ?? null);
      this.currentStep.set(state.currentStep === 2 ? 2 : 1);
      return true;
    } catch {
      return false;
    }
  }

  async ngOnInit(): Promise<void> {
    const isBrowser = isPlatformBrowser(this.platformId);
    const restored = isBrowser && this.restoreState();

    if (isBrowser && this.cartStore.items().length === 0) {
      this.router.navigate(['/cart']);
      return;
    }

    if (!restored && this.authService.currentUser()) {
      if (!this.userStore.user()) await this.userStore.loadUser();
      const u = this.userStore.user();
      if (u) {
        this.buyerFullName.set(u.fullName ?? '');
        this.buyerEmail.set(u.email);

        const phone = u.customerProfile?.phone ?? '';
        const phoneCode = u.customerProfile?.phoneCountryCode ?? null;
        this.prefillPhoneNumber.set(phone);
        this.prefillPhoneCode.set(phoneCode);
        if (phone && phoneCode) this.buyerPhone.set(`${phoneCode}${phone}`);

        const city = u.customerProfile?.city;
        if (city) {
          this.selectedCityId.set(city.id);
          this.initialCityId.set(city.id);
          this.buyerCity.set(city.id);
        }
        this.buyerAddress.set(u.customerProfile?.address ?? '');
      }
    }
  }

  coverUrl(product: Product): string | null {
    const cover =
      product.media.find((m) => m.isCover && m.mediaType === 'image') ??
      product.media.find((m) => m.mediaType === 'image');
    return cover ? this.productService.getMediaPublicUrl(cover.storagePath) : null;
  }

  /** Si el `<img>` falla al cargar (red, CDN), cae al emoji en vez de quedar con el ícono roto. */
  failedImageIds = signal<Set<string>>(new Set());

  onImageError(productId: string): void {
    this.failedImageIds.update((s) => new Set(s).add(productId));
  }

  next(): void {
    this.stepError.set(null);
    if (this.currentStep() === 1) {
      const missingContact =
        !this.buyerFullName().trim() || !this.buyerEmail().trim() || !this.buyerPhone().trim();
      const missingLocation = !this.selectedCityId() || !this.buyerAddress().trim();
      if (missingContact || missingLocation) {
        this.showContactErrors.set(missingContact);
        this.showLocationErrors.set(missingLocation);
        this.stepError.set(
          missingLocation
            ? 'Por favor selecciona tu departamento, municipio y dirección.'
            : 'Por favor completa los campos requeridos.',
        );
        return;
      }
    }
    if (!this.idempotencyKey()) this.idempotencyKey.set(crypto.randomUUID());
    this.currentStep.set(2);
  }

  back(): void {
    this.stepError.set(null);
    if (this.currentStep() === 1) {
      this.router.navigate(['/cart']);
    } else {
      this.currentStep.set(1);
    }
  }

  // The checkout API stores a single phone field, so the two parts travel joined.
  // Also re-seeds prefillPhoneNumber/Code: step 1 vive dentro de un @if, así que
  // ir al paso 2 y volver destruye y recrea app-phone-input — sin esto, el
  // número tipeado se perdía visualmente al volver (aunque buyerPhone seguía bien).
  onPhoneChange(value: PhoneValue | null): void {
    this.buyerPhone.set(value?.e164 ?? '');
    this.prefillPhoneNumber.set(value?.number ?? '');
    this.prefillPhoneCode.set(value?.dialCode ?? null);
  }

  onLocationChange(selection: LocationSelection | null): void {
    this.selectedCityId.set(selection?.cityId ?? null);
    this.buyerCity.set(selection?.cityId ?? '');
    // Mismo motivo que onPhoneChange: re-seedear para que sobreviva a que
    // app-location-select se destruya y recree al ir y volver del paso 2.
    this.initialCityId.set(selection?.cityId ?? null);

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

          const restoredId = this.pendingRestoredPickupPointId;
          this.pendingRestoredPickupPointId = null;
          if (restoredId && points.some((p) => p.id === restoredId)) {
            this.selectPickupPoint(restoredId);
          }
        },
        error: () => this.pickupPointsLoading.set(false),
      });
    }
  }

  private cartItems(): CheckoutCartItem[] {
    return this.cartStore.items().map((i) => ({ productId: i.product.id, quantity: i.quantity }));
  }

  selectPickupPoint(id: string): void {
    this.selectedPickupPointId.set(id);
    this.stepError.set(null);
    this.shippingCost.set(null);
    this.shippingCostLoading.set(true);
    this.orderService.getShippingEstimate(id, this.cartItems()).subscribe({
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
      if (!this.idempotencyKey()) this.idempotencyKey.set(crypto.randomUUID());

      const intent = await this.orderService.checkoutFromCart({
        idempotencyKey: this.idempotencyKey()!,
        pickupPointId: this.selectedPickupPointId()!,
        items: this.cartItems(),
        buyerFullName: this.buyerFullName(),
        buyerEmail: this.buyerEmail(),
        buyerPhone: this.buyerPhone() || undefined,
        buyerAddress: this.buyerAddress() || undefined,
        notes: this.notes() || undefined,
      });

      // The order now exists server-side (or was resumed via the idempotency
      // key) — checkout's job is done. The cart is intentionally NOT cleared
      // here: only a confirmed PAID outcome on /checkout/result clears it
      // (proposal §21 — redirect/widget is UX only, never proof of payment).
      if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);

      await this.wompiCheckout.open(intent, () => {
        // Widget closed (paid, declined, or simply dismissed) — never trust
        // this result directly; hand off to the page that confirms the real
        // outcome via get-payment-status / Realtime.
        this.router.navigate(['/checkout/result'], { queryParams: { orderId: intent.orderId } });
      });
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

  itemTotal(price: number, qty: number): number {
    return price * qty;
  }
}
