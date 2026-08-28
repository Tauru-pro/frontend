export interface SellerDashboardSummary {
  grossSales: number;
  ordersCount: number;
  dosesSold: number;
  averageOrderValue: number;
  totalCollected: number;
  platformCommission: number;
  sellerNet: number;
  pendingSettlement: number;
  settledAmount: number;
}

export type DashboardPeriod =
  | 'TODAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM';

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  TODAY: 'Hoy',
  LAST_7_DAYS: 'Últimos 7 días',
  LAST_30_DAYS: 'Últimos 30 días',
  THIS_MONTH: 'Este mes',
  LAST_MONTH: 'Mes anterior',
  THIS_YEAR: 'Este año',
  CUSTOM: 'Personalizado',
};

export function resolveDateRange(period: DashboardPeriod, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  switch (period) {
    case 'TODAY':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'LAST_7_DAYS': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'LAST_30_DAYS': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'THIS_MONTH':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case 'LAST_MONTH': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    case 'THIS_YEAR':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case 'CUSTOM':
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now),
        to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
      };
  }
}
