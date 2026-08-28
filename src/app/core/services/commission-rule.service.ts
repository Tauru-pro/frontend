import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { CommissionRule, ScheduleCommissionRuleChangeDto } from '../models/commission-rule.model';

interface CommissionRuleRow {
  id: string;
  segment_id: string;
  commission_rate: number;
  active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
}

function mapRow(row: CommissionRuleRow): CommissionRule {
  return {
    id: row.id,
    segmentId: row.segment_id,
    commissionRate: row.commission_rate,
    active: row.active,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class CommissionRuleService {
  private supabase = inject(SupabaseClientService).client;

  /** All rules for a segment, past and future, chronological (proposal §8 history view). */
  getForSegment(segmentId: string): Observable<CommissionRule[]> {
    return from(
      this.supabase
        .from('seller_segment_commission_rules')
        .select('*')
        .eq('segment_id', segmentId)
        .order('effective_from', { ascending: true }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as CommissionRuleRow[]).map(mapRow);
      }),
    );
  }

  /** The rate currently in effect for a segment (or null if none configured). */
  async getCurrentRate(segmentId: string): Promise<number | null> {
    const { data, error } = await this.supabase.rpc('get_current_commission_rate', {
      p_segment_id: segmentId,
    });
    if (error) throw new Error(error.message);
    return data as number | null;
  }

  /** Admin-only: schedule a rate change, preserving history (design.md Decision 4). */
  async scheduleChange(dto: ScheduleCommissionRuleChangeDto): Promise<string> {
    const { data, error } = await this.supabase.rpc('schedule_commission_rule_change', {
      p_segment_id: dto.segmentId,
      p_commission_rate: dto.commissionRate,
      p_effective_from: dto.effectiveFrom ?? new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return data as string;
  }
}
