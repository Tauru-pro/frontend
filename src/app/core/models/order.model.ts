export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentStatus = 'CREATED' | 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'EXPIRED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PaymentSummary {
  id: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  failureReason: string | null;
  approvedAt: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  buyerFullName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  buyerAddress: string | null;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  items: OrderItem[];
  /** Most recent payment attempt for this order, if any. */
  payment: PaymentSummary | null;
}

export interface CheckoutCartItem {
  productId: string;
  quantity: number;
}

export interface CreateCheckoutRequest {
  idempotencyKey: string;
  pickupPointId: string;
  items: CheckoutCartItem[];
  buyerFullName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerAddress?: string;
  notes?: string;
}

/** Response from create-checkout / retry-payment — everything Angular needs to open the Wompi Widget. */
export interface CheckoutPaymentIntent {
  orderId: string;
  paymentId: string;
  reference: string;
  currency: string;
  amountInCents: number;
  publicKey: string;
  integritySignature: string;
  redirectUrl: string;
}

export interface ShippingEstimateBreakdown {
  sellerId: string;
  sellerName: string;
  originState: string;
  shippingCost: number;
}

export interface ShippingEstimate {
  breakdown: ShippingEstimateBreakdown[];
  totalShipping: number;
}
