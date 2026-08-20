import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { PaginatedResponse } from '../models/product.model';
import {
  CheckoutCartItem,
  CheckoutPaymentIntent,
  CreateCheckoutRequest,
  Order,
  OrderItem,
  PaymentSummary,
  ShippingEstimate,
} from '../models/order.model';

interface OrderItemRow {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PaymentRow {
  id: string;
  status: PaymentSummary['status'];
  payment_method: string | null;
  failure_reason: string | null;
  approved_at: string | null;
  created_at?: string;
}

interface OrderRow {
  id: string;
  status: Order['status'];
  currency: string;
  subtotal: number;
  tax: number;
  shipping_cost: number;
  discount: number;
  total: number;
  buyer_full_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  buyer_address: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  order_items?: OrderItemRow[];
  payments?: PaymentRow[];
}

const ORDER_SELECT =
  '*, order_items(id, product_id, product_name, quantity, unit_price, subtotal), payments(id, status, payment_method, failure_reason, approved_at, created_at)';

function mapItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    subtotal: row.subtotal,
  };
}

function mapPayment(row: PaymentRow): PaymentSummary {
  return {
    id: row.id,
    status: row.status,
    paymentMethod: row.payment_method,
    failureReason: row.failure_reason,
    approvedAt: row.approved_at,
  };
}

function latestPayment(rows: PaymentRow[] | undefined): PaymentSummary | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return mapPayment(sorted[0]);
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    status: row.status,
    currency: row.currency,
    subtotal: row.subtotal,
    tax: row.tax,
    shippingCost: row.shipping_cost,
    discount: row.discount,
    total: row.total,
    buyerFullName: row.buyer_full_name,
    buyerEmail: row.buyer_email,
    buyerPhone: row.buyer_phone,
    buyerAddress: row.buyer_address,
    notes: row.notes,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
    items: (row.order_items ?? []).map(mapItem),
    payment: latestPayment(row.payments),
  };
}

interface ShippingEstimateRow {
  seller_id: string;
  seller_name: string;
  origin_state_name: string;
  shipping_cost: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private supabase = inject(SupabaseClientService).client;

  /** Calls the create-checkout Edge Function — pricing/totals/Wompi signature are computed server-side. */
  async checkoutFromCart(dto: CreateCheckoutRequest): Promise<CheckoutPaymentIntent> {
    const { data, error } = await this.supabase.functions.invoke('create-checkout', { body: dto });
    if (error) throw new Error(error.message ?? 'No se pudo crear la orden.');
    return data as CheckoutPaymentIntent;
  }

  /** Starts a new payment attempt on an order stuck in PAYMENT_FAILED. */
  async retryPayment(orderId: string): Promise<CheckoutPaymentIntent> {
    const { data, error } = await this.supabase.functions.invoke('retry-payment', { body: { orderId } });
    if (error) throw new Error(error.message ?? 'No se pudo reintentar el pago.');
    return data as CheckoutPaymentIntent;
  }

  /** Buyer-facing shipping preview — calls the same get_shipping_estimate() function create-checkout uses, so the number shown here always matches the authoritative total. */
  getShippingEstimate(pickupPointId: string, items: CheckoutCartItem[]): Observable<ShippingEstimate> {
    const rpcItems = items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
    return from(
      this.supabase.rpc('get_shipping_estimate', {
        p_pickup_point_id: pickupPointId,
        p_items: rpcItems,
      }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const rows = (data ?? []) as ShippingEstimateRow[];
        return {
          breakdown: rows.map((r) => ({
            sellerId: r.seller_id,
            sellerName: r.seller_name,
            originState: r.origin_state_name,
            shippingCost: r.shipping_cost,
          })),
          totalShipping: rows.reduce((sum, r) => sum + r.shipping_cost, 0),
        };
      }),
    );
  }

  getOne(id: string): Observable<Order> {
    return from(this.supabase.from('orders').select(ORDER_SELECT).eq('id', id).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapOrder(data as unknown as OrderRow);
      }),
    );
  }

  /** The buyer's own orders — RLS already scopes this to auth.uid(), no explicit filter needed. */
  getMyOrders(page = 1, limit = 10): Observable<PaginatedResponse<Order>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    const query = this.supabase
      .from('orders')
      .select(ORDER_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_, to);

    return from(query).pipe(
      map(({ data, error, count }) => {
        if (error) throw error;
        const total = count ?? 0;
        return {
          data: (data as unknown as OrderRow[]).map(mapOrder),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }
}
