import { inject, Injectable } from '@angular/core';
import { SupabaseClientService } from '../auth/supabase-client';
import { OrderStatus, PaymentStatus } from '../models/order.model';

export interface PaymentStatusResponse {
  orderId: string;
  orderStatus: OrderStatus;
  total: number;
  currency: string;
  paidAt: string | null;
  payments: { id: string; status: PaymentStatus; payment_method: string | null; failure_reason: string | null }[];
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private supabase = inject(SupabaseClientService).client;

  async getStatus(orderId: string): Promise<PaymentStatusResponse> {
    const { data, error } = await this.supabase.functions.invoke('get-payment-status', { body: { orderId } });
    if (error) throw new Error(error.message ?? 'No se pudo consultar el estado del pago.');
    return data as PaymentStatusResponse;
  }

  /**
   * Realtime updates for a single order — used by /checkout/result and the order-detail
   * page so the buyer sees PAYMENT_PROCESSING -> PAID without reloading. Callback fires
   * on any change to the row; caller re-fetches (getStatus/getOne) for the full shape.
   */
  watchOrder(orderId: string, onChange: () => void): () => void {
    const channel = this.supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `order_id=eq.${orderId}` },
        onChange,
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}
