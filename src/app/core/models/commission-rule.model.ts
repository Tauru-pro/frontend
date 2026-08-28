export interface CommissionRule {
  id: string;
  segmentId: string;
  commissionRate: number;
  active: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdAt: string;
}

export interface ScheduleCommissionRuleChangeDto {
  segmentId: string;
  commissionRate: number;
  effectiveFrom?: string;
}
