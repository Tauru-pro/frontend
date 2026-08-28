import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import {
  CreateSellerSegmentDto,
  SellerInSegment,
  SellerSegment,
  UpdateSellerSegmentDto,
} from '../models/seller-segment.model';

interface SellerSegmentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapRow(row: SellerSegmentRow): SellerSegment {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class SellerSegmentService {
  private supabase = inject(SupabaseClientService).client;

  getAll(): Observable<SellerSegment[]> {
    return from(
      this.supabase.from('seller_segments').select('*').order('name', { ascending: true }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SellerSegmentRow[]).map(mapRow);
      }),
    );
  }

  getOne(id: string): Observable<SellerSegment> {
    return from(this.supabase.from('seller_segments').select('*').eq('id', id).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as SellerSegmentRow);
      }),
    );
  }

  async create(dto: CreateSellerSegmentDto): Promise<SellerSegment> {
    const { data, error } = await this.supabase
      .from('seller_segments')
      .insert({ code: dto.code, name: dto.name, description: dto.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_CODE' : error.message);
    return mapRow(data as SellerSegmentRow);
  }

  async update(id: string, dto: UpdateSellerSegmentDto): Promise<SellerSegment> {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) row['name'] = dto.name;
    if (dto.description !== undefined) row['description'] = dto.description;
    if (dto.active !== undefined) row['active'] = dto.active;

    const { data, error } = await this.supabase
      .from('seller_segments')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as SellerSegmentRow);
  }

  /** Sellers currently assigned to a segment — for the admin "sellers in this segment" view. */
  getSellersInSegment(segmentId: string): Observable<SellerInSegment[]> {
    return from(
      this.supabase
        .from('seller_profiles')
        .select('id, business_name, status')
        .eq('segment_id', segmentId)
        .order('business_name', { ascending: true }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as { id: string; business_name: string; status: string }[]).map((r) => ({
          id: r.id,
          businessName: r.business_name,
          status: r.status,
        }));
      }),
    );
  }

  /** Admin-only: assign/reassign a seller's segment (also completes verification if applicable). */
  async assignSellerSegment(sellerId: string, segmentId: string): Promise<void> {
    const { error } = await this.supabase.rpc('assign_seller_segment', {
      p_seller_id: sellerId,
      p_segment_id: segmentId,
    });
    if (error) throw new Error(error.message);
  }

  /** The calling seller's own segment — informational, read-only (proposal §22). */
  async getOwnSegment(): Promise<{ segmentId: string | null; segmentName: string | null }> {
    const { data, error } = await this.supabase
      .from('seller_profiles')
      .select('segment_id, seller_segments(name)')
      .eq('user_id', (await this.supabase.auth.getUser()).data.user?.id ?? '')
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as unknown as { segment_id: string | null; seller_segments: { name: string } | null } | null;
    return {
      segmentId: row?.segment_id ?? null,
      segmentName: row?.seller_segments?.name ?? null,
    };
  }
}
