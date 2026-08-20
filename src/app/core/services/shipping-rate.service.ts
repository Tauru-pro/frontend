import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { PaginatedResponse } from '../models/product.model';
import {
  ShippingRate,
  CreateShippingRateDto,
  UpdateShippingRateDto,
} from '../models/shipping-rate.model';

interface ShippingRateRow {
  id: string;
  base_rate: number;
  created_at: string;
  updated_at: string;
  origin: { id: string; name: string } | null;
  destination: { id: string; name: string } | null;
}

const SHIPPING_RATE_SELECT =
  '*, origin:states!shipping_rates_origin_state_id_fkey(id, name), destination:states!shipping_rates_destination_state_id_fkey(id, name)';

function mapRow(row: ShippingRateRow): ShippingRate {
  return {
    id: row.id,
    origin: row.origin ?? { id: '', name: '' },
    destination: row.destination ?? { id: '', name: '' },
    baseRate: row.base_rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ShippingRateService {
  private supabase = inject(SupabaseClientService).client;

  getAll(page = 1, limit = 10): Observable<PaginatedResponse<ShippingRate>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    const query = this.supabase
      .from('shipping_rates')
      .select(SHIPPING_RATE_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_, to);

    return from(query).pipe(
      map(({ data, error, count }) => {
        if (error) throw error;
        const total = count ?? 0;
        return {
          data: (data as unknown as ShippingRateRow[]).map(mapRow),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }

  getOne(id: string): Observable<ShippingRate> {
    return from(
      this.supabase.from('shipping_rates').select(SHIPPING_RATE_SELECT).eq('id', id).single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as unknown as ShippingRateRow);
      }),
    );
  }

  create(dto: CreateShippingRateDto): Observable<ShippingRate> {
    return from(
      this.supabase
        .from('shipping_rates')
        .insert({
          origin_state_id: dto.originId,
          destination_state_id: dto.destinationId,
          base_rate: dto.baseRate,
        })
        .select(SHIPPING_RATE_SELECT)
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as unknown as ShippingRateRow);
      }),
    );
  }

  update(id: string, dto: UpdateShippingRateDto): Observable<ShippingRate> {
    const row: Record<string, unknown> = {};
    if (dto.originId !== undefined) row['origin_state_id'] = dto.originId;
    if (dto.destinationId !== undefined) row['destination_state_id'] = dto.destinationId;
    if (dto.baseRate !== undefined) row['base_rate'] = dto.baseRate;

    return from(
      this.supabase.from('shipping_rates').update(row).eq('id', id).select(SHIPPING_RATE_SELECT).single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as unknown as ShippingRateRow);
      }),
    );
  }

  delete(id: string): Observable<void> {
    return from(this.supabase.from('shipping_rates').delete().eq('id', id)).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
    );
  }
}
