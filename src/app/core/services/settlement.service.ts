import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { Settlement, SettlementItem, SettlementStatus } from '../models/settlement.model';
import { SellerEarning } from '../models/seller-earning.model';

interface SettlementRow {
  id: string;
  seller_id: string;
  settlement_number: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: SettlementStatus;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  processed_at: string | null;
  notes: string | null;
}

function mapRow(row: SettlementRow): Settlement {
  return {
    id: row.id,
    sellerId: row.seller_id,
    settlementNumber: row.settlement_number,
    grossAmount: row.gross_amount,
    commissionAmount: row.commission_amount,
    netAmount: row.net_amount,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    notes: row.notes,
  };
}

@Injectable({ providedIn: 'root' })
export class SettlementService {
  private supabase = inject(SupabaseClientService).client;

  /** Own settlements (seller) or all (admin) — RLS scopes the result. */
  getAll(): Observable<Settlement[]> {
    return from(
      this.supabase.from('settlements').select('*').order('created_at', { ascending: false }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SettlementRow[]).map(mapRow);
      }),
    );
  }

  getOne(id: string): Observable<Settlement> {
    return from(this.supabase.from('settlements').select('*').eq('id', id).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as SettlementRow);
      }),
    );
  }

  /** Earnings included in a settlement, joined so the originating order is visible for audit (proposal §26). */
  getItemsWithEarnings(settlementId: string): Observable<{ item: SettlementItem; earning: SellerEarning }[]> {
    return from(
      this.supabase
        .from('settlement_items')
        .select('*, seller_earnings(*)')
        .eq('settlement_id', settlementId),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (
          data as unknown as {
            id: string;
            settlement_id: string;
            seller_earning_id: string;
            created_at: string;
            seller_earnings: {
              id: string;
              seller_id: string;
              order_id: string;
              payment_id: string;
              gross_amount: number;
              commission_rate: number;
              commission_amount: number;
              seller_net_amount: number;
              status: SellerEarning['status'];
              needs_commission_review: boolean;
              reversal_of_earning_id: string | null;
              backfilled: boolean;
              created_at: string;
            };
          }[]
        ).map((row) => ({
          item: {
            id: row.id,
            settlementId: row.settlement_id,
            sellerEarningId: row.seller_earning_id,
            createdAt: row.created_at,
          },
          earning: {
            id: row.seller_earnings.id,
            sellerId: row.seller_earnings.seller_id,
            orderId: row.seller_earnings.order_id,
            paymentId: row.seller_earnings.payment_id,
            grossAmount: row.seller_earnings.gross_amount,
            commissionRate: row.seller_earnings.commission_rate,
            commissionAmount: row.seller_earnings.commission_amount,
            sellerNetAmount: row.seller_earnings.seller_net_amount,
            status: row.seller_earnings.status,
            needsCommissionReview: row.seller_earnings.needs_commission_review,
            reversalOfEarningId: row.seller_earnings.reversal_of_earning_id,
            backfilled: row.seller_earnings.backfilled,
            createdAt: row.seller_earnings.created_at,
          },
        }));
      }),
    );
  }

  async create(
    sellerId: string,
    earningIds: string[],
    periodStart?: string,
    periodEnd?: string,
    notes?: string,
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_settlement', {
      p_seller_id: sellerId,
      p_earning_ids: earningIds,
      p_period_start: periodStart ?? null,
      p_period_end: periodEnd ?? null,
      p_notes: notes ?? null,
    });
    if (error) throw new Error(error.message);
    return data as string;
  }

  async markPaid(settlementId: string): Promise<void> {
    const { error } = await this.supabase.rpc('mark_settlement_paid', { p_settlement_id: settlementId });
    if (error) throw new Error(error.message);
  }

  async cancel(settlementId: string, reason?: string): Promise<void> {
    const { error } = await this.supabase.rpc('cancel_settlement', {
      p_settlement_id: settlementId,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);
  }
}
