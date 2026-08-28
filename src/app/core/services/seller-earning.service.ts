import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { SellerEarning, SellerEarningStatus } from '../models/seller-earning.model';

interface SellerEarningRow {
  id: string;
  seller_id: string;
  order_id: string;
  payment_id: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  seller_net_amount: number;
  status: SellerEarningStatus;
  needs_commission_review: boolean;
  reversal_of_earning_id: string | null;
  backfilled: boolean;
  created_at: string;
}

function mapRow(row: SellerEarningRow): SellerEarning {
  return {
    id: row.id,
    sellerId: row.seller_id,
    orderId: row.order_id,
    paymentId: row.payment_id,
    grossAmount: row.gross_amount,
    commissionRate: row.commission_rate,
    commissionAmount: row.commission_amount,
    sellerNetAmount: row.seller_net_amount,
    status: row.status,
    needsCommissionReview: row.needs_commission_review,
    reversalOfEarningId: row.reversal_of_earning_id,
    backfilled: row.backfilled,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class SellerEarningService {
  private supabase = inject(SupabaseClientService).client;

  /** Own earnings — RLS scopes this to the calling seller. */
  getOwn(): Observable<SellerEarning[]> {
    return from(
      this.supabase.from('seller_earnings').select('*').order('created_at', { ascending: false }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SellerEarningRow[]).map(mapRow);
      }),
    );
  }

  /** Admin: AVAILABLE earnings for a seller, for the settlement picker. */
  getAvailableForSeller(sellerId: string): Observable<SellerEarning[]> {
    return from(
      this.supabase
        .from('seller_earnings')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('status', 'AVAILABLE')
        .order('created_at', { ascending: true }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SellerEarningRow[]).map(mapRow);
      }),
    );
  }

  /** Admin: earnings flagged for manual commission review. */
  getFlaggedForReview(): Observable<SellerEarning[]> {
    return from(
      this.supabase
        .from('seller_earnings')
        .select('*')
        .eq('needs_commission_review', true)
        .order('created_at', { ascending: true }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SellerEarningRow[]).map(mapRow);
      }),
    );
  }

  /** Count of earnings flagged for manual commission review — for the admin sidebar badge. */
  async getFlaggedForReviewCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('seller_earnings')
      .select('id', { count: 'exact', head: true })
      .eq('needs_commission_review', true);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async resolveCommission(earningId: string, commissionRate: number): Promise<void> {
    const { error } = await this.supabase.rpc('resolve_earning_commission', {
      p_earning_id: earningId,
      p_commission_rate: commissionRate,
    });
    if (error) throw new Error(error.message);
  }

  async reverse(earningId: string, reason: string): Promise<void> {
    const { error } = await this.supabase.rpc('reverse_seller_earning', {
      p_earning_id: earningId,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  }
}
