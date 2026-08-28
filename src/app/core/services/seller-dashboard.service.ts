import { inject, Injectable } from '@angular/core';
import { SupabaseClientService } from '../auth/supabase-client';
import { SellerDashboardSummary } from '../models/seller-dashboard.model';

@Injectable({ providedIn: 'root' })
export class SellerDashboardService {
  private supabase = inject(SupabaseClientService).client;

  async getSummary(dateFrom: Date, dateTo: Date): Promise<SellerDashboardSummary> {
    const { data, error } = await this.supabase.rpc('get_seller_dashboard_summary', {
      p_date_from: dateFrom.toISOString(),
      p_date_to: dateTo.toISOString(),
    });
    if (error) throw new Error(error.message);
    const raw = data as Record<string, number>;
    return {
      grossSales: raw['grossSales'] ?? 0,
      ordersCount: raw['ordersCount'] ?? 0,
      dosesSold: raw['dosesSold'] ?? 0,
      averageOrderValue: raw['averageOrderValue'] ?? 0,
      totalCollected: raw['totalCollected'] ?? 0,
      platformCommission: raw['platformCommission'] ?? 0,
      sellerNet: raw['sellerNet'] ?? 0,
      pendingSettlement: raw['pendingSettlement'] ?? 0,
      settledAmount: raw['settledAmount'] ?? 0,
    };
  }

  /**
   * Realtime updates for the calling seller's own earnings/settlements — the
   * dashboard refetches its summary on any change. RLS already scopes what
   * this subscription receives, so no seller_id filter is needed here (unlike
   * PaymentService.watchOrder, which filters by a known order id).
   */
  watchOwnFinancials(sellerId: string, onChange: () => void): () => void {
    const channel = this.supabase
      .channel(`seller-financials-${sellerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seller_earnings', filter: `seller_id=eq.${sellerId}` },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `seller_id=eq.${sellerId}` },
        onChange,
      )
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }
}
