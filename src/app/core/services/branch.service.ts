import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Branch, BranchStatus, CreateBranchDto, UpdateBranchDto } from '../models/branch.model';
import { PaginatedResponse } from '../models/product.model';
import { SupabaseClientService } from '../auth/supabase-client';
import { getJwtClaim } from '../auth/jwt-claims';

interface BranchRow {
  id: string;
  tenant_id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  business_hours: string | null;
  is_main: boolean;
  status: Branch['status'];
  created_at: string;
  updated_at: string;
  cities: {
    id: string;
    name: string;
    states: { id: string; name: string } | null;
  } | null;
}

function mapBranchRow(row: BranchRow): Branch {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    businessHours: row.business_hours ?? undefined,
    isMain: row.is_main,
    status: row.status,
    city: row.cities
      ? { id: row.cities.id, name: row.cities.name, state: row.cities.states ?? { id: '', name: '' } }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class BranchService {
  private supabase = inject(SupabaseClientService).client;

  getMyBranches(
    page = 1,
    limit = 10,
    status?: BranchStatus
  ): Observable<PaginatedResponse<Branch>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    let query = this.supabase
      .from('branches')
      .select('*, cities(id, name, states(id, name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_, to);
    if (status) query = query.eq('status', status);

    return from(query).pipe(
      map(({ data, error, count }) => {
        if (error) throw error;
        const total = count ?? 0;
        return {
          data: (data as BranchRow[]).map(mapBranchRow),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      })
    );
  }

  getBranch(id: string): Observable<Branch> {
    return from(this.supabase.from('branches').select('*, cities(id, name, states(id, name))').eq('id', id).single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapBranchRow(data as BranchRow);
      })
    );
  }

  // RLS only checks tenant_id on write, it doesn't populate it — the
  // caller's tenant_id comes from the verified JWT claim, not a form field.
  async createBranch(dto: CreateBranchDto): Promise<Branch> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const { data, error } = await this.supabase
      .from('branches')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        address: dto.address,
        city_id: dto.cityId,
        phone: dto.phone,
        latitude: dto.latitude,
        longitude: dto.longitude,
        business_hours: dto.businessHours,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_NAME' : error.message);
    return mapBranchRow(data as BranchRow);
  }

  async updateBranch(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) row['name'] = dto.name;
    if (dto.address !== undefined) row['address'] = dto.address;
    if (dto.cityId !== undefined) row['city_id'] = dto.cityId;
    if (dto.phone !== undefined) row['phone'] = dto.phone;
    if (dto.latitude !== undefined) row['latitude'] = dto.latitude;
    if (dto.longitude !== undefined) row['longitude'] = dto.longitude;
    if (dto.businessHours !== undefined) row['business_hours'] = dto.businessHours;

    const { data, error } = await this.supabase
      .from('branches')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_NAME' : error.message);
    return mapBranchRow(data as BranchRow);
  }

  async deleteBranch(id: string): Promise<void> {
    const { error } = await this.supabase.from('branches').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // The enforce_single_main_branch trigger unmarks the previous main branch
  // atomically — no separate "unset" call needed here.
  async setMain(id: string): Promise<void> {
    const { error } = await this.supabase.from('branches').update({ is_main: true }).eq('id', id);
    if (error) throw new Error(error.message);
  }
}
