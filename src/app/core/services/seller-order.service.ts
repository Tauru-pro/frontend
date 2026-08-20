import { inject, Injectable } from '@angular/core';
import { SupabaseClientService } from '../auth/supabase-client';
import { PaginatedResponse } from '../models/product.model';
import {
  FulfillmentStatus,
  SellerOrderDetail,
  SellerOrderFilters,
  SellerOrderSummary,
} from '../models/seller-order.model';

interface SellerOrdersRpcResponse {
  data: SellerOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Thrown by updateFulfillmentStatus on a 409 — the record's status already moved since it was fetched. */
export class FulfillmentConflictError extends Error {
  constructor() {
    super('El estado de la orden cambió desde que se cargó. Actualiza para ver el estado actual.');
  }
}

@Injectable({ providedIn: 'root' })
export class SellerOrderService {
  private supabase = inject(SupabaseClientService).client;

  async getOrders(
    filters: SellerOrderFilters,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResponse<SellerOrderSummary>> {
    const { data, error } = await this.supabase.functions.invoke('seller-orders', {
      body: {
        status: filters.status ?? null,
        paymentStatus: filters.paymentStatus ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        search: filters.search ?? null,
        page,
        pageSize,
      },
    });
    if (error) throw new Error(error.message ?? 'No se pudieron cargar las órdenes.');
    const res = data as SellerOrdersRpcResponse;
    return {
      data: res.data,
      total: res.total,
      page: res.page,
      limit: res.pageSize,
      totalPages: res.totalPages,
    };
  }

  async getOrder(orderId: string): Promise<SellerOrderDetail | null> {
    const { data, error } = await this.supabase.functions.invoke('seller-orders', {
      body: { orderId },
    });
    if (error) throw new Error(error.message ?? 'No se pudo cargar la orden.');
    return (data as { data: SellerOrderDetail | null } | null)?.data ?? null;
  }

  async updateFulfillmentStatus(
    orderId: string,
    status: FulfillmentStatus,
    reason?: string,
  ): Promise<void> {
    const { error } = await this.supabase.functions.invoke('seller-orders-fulfillment', {
      body: { orderId, status, reason: reason ?? null },
    });
    if (error) {
      const httpStatus = (error as { context?: { status?: number } }).context?.status;
      if (httpStatus === 409) throw new FulfillmentConflictError();
      throw new Error(error.message ?? 'No se pudo actualizar el estado de la orden.');
    }
  }

  /**
   * Realtime updates for the current seller's fulfillment records — mirrors
   * PaymentService.watchOrder. RLS already scopes which rows the subscriber
   * receives, so no explicit seller_id filter is needed here.
   */
  watchFulfillments(onChange: () => void): () => void {
    const channel = this.supabase
      .channel('seller-order-fulfillments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_seller_fulfillments' },
        onChange,
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}
