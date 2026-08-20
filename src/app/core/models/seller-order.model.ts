import { PaymentStatus } from './order.model';

export type FulfillmentStatus = 'RECEIVED' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

export interface SellerOrderSummary {
  orderId: string;
  createdAt: string;
  buyerName: string;
  fulfillmentStatus: FulfillmentStatus;
  fulfillmentUpdatedAt: string;
  paymentStatus: PaymentStatus | null;
  itemCount: number;
  sellerSubtotal: number;
}

export interface SellerOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Never includes amount or raw_response — read-only, non-financial context only. */
export interface SellerPaymentSummary {
  status: PaymentStatus;
  paymentMethod: string | null;
  providerReference: string;
  providerTransactionId: string | null;
  approvedAt: string | null;
}

export interface FulfillmentHistoryEntry {
  fromStatus: FulfillmentStatus | null;
  toStatus: FulfillmentStatus;
  actorType: 'SELLER' | 'SYSTEM' | 'ADMIN';
  reason: string | null;
  createdAt: string;
}

export interface SellerOrderFulfillment {
  id: string;
  status: FulfillmentStatus;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** No buyer address — pickup-point based checkout, seller only needs the pickup point. */
export interface SellerOrderDetail {
  orderId: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  pickupPoint: { name: string; address: string } | null;
  items: SellerOrderItem[];
  sellerSubtotal: number;
  fulfillment: SellerOrderFulfillment;
  history: FulfillmentHistoryEntry[];
  payment: SellerPaymentSummary | null;
}

export interface SellerOrderFilters {
  status?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
