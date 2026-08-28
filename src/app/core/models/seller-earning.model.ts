export type SellerEarningStatus = 'PENDING' | 'AVAILABLE' | 'IN_SETTLEMENT' | 'SETTLED' | 'REVERSED';

export interface SellerEarning {
  id: string;
  sellerId: string;
  orderId: string;
  paymentId: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  sellerNetAmount: number;
  status: SellerEarningStatus;
  needsCommissionReview: boolean;
  reversalOfEarningId: string | null;
  backfilled: boolean;
  createdAt: string;
}
