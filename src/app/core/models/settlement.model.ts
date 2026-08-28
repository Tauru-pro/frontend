export type SettlementStatus = 'DRAFT' | 'PENDING' | 'PROCESSING' | 'PAID' | 'CANCELLED' | 'FAILED';

export interface Settlement {
  id: string;
  sellerId: string;
  settlementNumber: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: SettlementStatus;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  processedAt: string | null;
  notes: string | null;
}

export interface SettlementItem {
  id: string;
  settlementId: string;
  sellerEarningId: string;
  createdAt: string;
}
