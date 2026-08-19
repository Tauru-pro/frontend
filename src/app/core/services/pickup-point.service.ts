import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { PaginatedResponse } from '../models/product.model';
import {
  PickupPoint,
  PickupPointStatus,
  CreatePickupPointDto,
  UpdatePickupPointDto,
} from '../models/pickup-point.model';

interface PickupPointRow {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: PickupPointStatus;
  created_at: string;
  updated_at: string;
  cities: {
    id: string;
    name: string;
    states: { id: string; name: string } | null;
  } | null;
}

const PICKUP_POINT_SELECT = '*, cities(id, name, states(id, name))';

function mapRow(row: PickupPointRow): PickupPoint {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    status: row.status,
    city: row.cities
      ? { id: row.cities.id, name: row.cities.name, state: row.cities.states ?? undefined }
      : { id: '', name: '' },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class PickupPointService {
  private supabase = inject(SupabaseClientService).client;

  getAll(page = 1, limit = 10): Observable<PaginatedResponse<PickupPoint>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    const query = this.supabase
      .from('pickup_points')
      .select(PICKUP_POINT_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_, to);

    return from(query).pipe(
      map(({ data, error, count }) => {
        if (error) throw error;
        const total = count ?? 0;
        return {
          data: (data as unknown as PickupPointRow[]).map(mapRow),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }

  /** Puntos activos de un departamento — usado en el checkout para que el comprador elija dónde retirar. */
  getByDepartment(stateId: string): Observable<PickupPoint[]> {
    const query = this.supabase
      .from('pickup_points')
      .select('*, cities!inner(id, name, states(id, name))')
      .eq('cities.state_id', stateId)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true });

    return from(query).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as unknown as PickupPointRow[]).map(mapRow);
      }),
    );
  }

  getOne(id: string): Observable<PickupPoint> {
    return from(
      this.supabase.from('pickup_points').select(PICKUP_POINT_SELECT).eq('id', id).single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as unknown as PickupPointRow);
      }),
    );
  }

  async create(dto: CreatePickupPointDto): Promise<PickupPoint> {
    const { data, error } = await this.supabase
      .from('pickup_points')
      .insert({
        name: dto.name,
        address: dto.address,
        city_id: dto.cityId,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      })
      .select(PICKUP_POINT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as PickupPointRow);
  }

  async update(id: string, dto: UpdatePickupPointDto): Promise<PickupPoint> {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) row['name'] = dto.name;
    if (dto.address !== undefined) row['address'] = dto.address;
    if (dto.cityId !== undefined) row['city_id'] = dto.cityId;
    if (dto.latitude !== undefined) row['latitude'] = dto.latitude;
    if (dto.longitude !== undefined) row['longitude'] = dto.longitude;

    const { data, error } = await this.supabase
      .from('pickup_points')
      .update(row)
      .eq('id', id)
      .select(PICKUP_POINT_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as PickupPointRow);
  }

  async setStatus(id: string, status: PickupPointStatus): Promise<void> {
    const { error } = await this.supabase.from('pickup_points').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('pickup_points').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
