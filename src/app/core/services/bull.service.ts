import { inject, Injectable } from '@angular/core';
import { from, map, Observable, of, switchMap } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { getJwtClaim } from '../auth/jwt-claims';
import {
  Bull,
  BullMedia,
  BullOrigin,
  BullRegistrationType,
  BullStatus,
  CreateBullDto,
  PaginatedBulls,
  UpdateBullDto,
} from '../models/bull.model';
import { PaginatedResponse } from '../models/product.model';

interface BullRow {
  id: string;
  tenant_id: string;
  name: string;
  breed_id: string | null;
  origin: BullOrigin | null;
  registration_type: BullRegistrationType | null;
  code: string | null;
  description: string | null;
  status: BullStatus;
  created_at: string;
  updated_at: string;
  breeds: { id: string; name: string; purpose: 'MILK' | 'MEAT'; created_at: string; updated_at: string } | null;
  product_media: MediaRow[];
}

interface MediaRow {
  id: string;
  entity_type: 'bull' | 'product';
  entity_id: string;
  media_type: 'image' | 'video' | 'document';
  storage_path: string;
  mime_type: string | null;
  sort_order: number | null;
  is_cover: boolean;
  created_at: string;
}

function mapMediaRow(row: MediaRow): BullMedia {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    isCover: row.is_cover,
    createdAt: row.created_at,
  };
}

function mapBullRow(row: BullRow): Bull {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    breedId: row.breed_id ?? '',
    breed: row.breeds
      ? { id: row.breeds.id, name: row.breeds.name, purpose: row.breeds.purpose, createdAt: row.breeds.created_at, updatedAt: row.breeds.updated_at }
      : { id: '', name: '', purpose: 'MEAT' as const, createdAt: '', updatedAt: '' },
    origin: row.origin ?? 'NATIONAL',
    registrationType: row.registration_type,
    code: row.code,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: (row.product_media ?? []).map(mapMediaRow),
  };
}

function groupMediaById(rows: MediaRow[]): Map<string, MediaRow[]> {
  const map = new Map<string, MediaRow[]>();
  for (const m of rows) {
    if (!map.has(m.entity_id)) map.set(m.entity_id, []);
    map.get(m.entity_id)!.push(m);
  }
  return map;
}

const BULL_SELECT = `
  id, tenant_id, name, breed_id, origin, registration_type, code, description, status, created_at, updated_at,
  breeds(id, name, purpose, created_at, updated_at)
`.trim();

const MEDIA_SELECT = `id, entity_type, entity_id, media_type, storage_path, mime_type, sort_order, is_cover, created_at`;

@Injectable({ providedIn: 'root' })
export class BullService {
  private supabase = inject(SupabaseClientService).client;
  private readonly bucket = 'product-media';

  private fetchBullMedia(ids: string[]): Observable<Map<string, MediaRow[]>> {
    if (ids.length === 0) return of(new Map());
    return from(
      this.supabase
        .from('product_media')
        .select(MEDIA_SELECT)
        .in('entity_id', ids)
        .eq('entity_type', 'bull'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return groupMediaById((data ?? []) as MediaRow[]);
      }),
    );
  }

  getMyBulls(page = 1, limit = 10, status?: BullStatus): Observable<PaginatedBulls> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    let query = this.supabase
      .from('bulls')
      .select(BULL_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_, to);
    if (status) query = query.eq('status', status);

    return from(query).pipe(
      switchMap(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as BullRow[]) ?? [];
        const total = count ?? 0;
        if (rows.length === 0) return of({ data: [], total, page, limit, totalPages: Math.ceil(total / limit) });
        return this.fetchBullMedia(rows.map((r) => r.id)).pipe(
          map((mediaMap) => ({
            data: rows.map((r) => mapBullRow({ ...r, product_media: mediaMap.get(r.id) ?? [] })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          })),
        );
      }),
    );
  }

  getBull(id: string): Observable<Bull> {
    return from(
      this.supabase.from('bulls').select(BULL_SELECT).eq('id', id).single(),
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        const row = data as unknown as BullRow;
        return from(
          this.supabase
            .from('product_media')
            .select(MEDIA_SELECT)
            .eq('entity_id', id)
            .eq('entity_type', 'bull'),
        ).pipe(
          map(({ data: mediaData, error: mediaError }) => {
            if (mediaError) throw mediaError;
            return mapBullRow({ ...row, product_media: (mediaData ?? []) as MediaRow[] });
          }),
        );
      }),
    );
  }

  async createBull(dto: CreateBullDto): Promise<Bull> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const { data, error } = await this.supabase
      .from('bulls')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        breed_id: dto.breedId,
        origin: dto.origin,
        registration_type: dto.registrationType ?? null,
        code: dto.code ?? null,
        description: dto.description ?? null,
      })
      .select(BULL_SELECT)
      .single();

    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_CODE' : error.message);
    return mapBullRow({ ...(data as unknown as BullRow), product_media: [] });
  }

  async updateBull(id: string, dto: UpdateBullDto): Promise<Bull> {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) row['name'] = dto.name;
    if (dto.breedId !== undefined) row['breed_id'] = dto.breedId;
    if (dto.origin !== undefined) row['origin'] = dto.origin;
    if (dto.registrationType !== undefined) row['registration_type'] = dto.registrationType;
    if (dto.code !== undefined) row['code'] = dto.code ?? null;
    if (dto.description !== undefined) row['description'] = dto.description ?? null;

    const { data, error } = await this.supabase
      .from('bulls')
      .update(row)
      .eq('id', id)
      .select(BULL_SELECT)
      .single();

    if (error) throw new Error(error.code === '23505' ? 'DUPLICATE_CODE' : error.message);

    const { data: mediaData } = await this.supabase
      .from('product_media')
      .select(MEDIA_SELECT)
      .eq('entity_id', id)
      .eq('entity_type', 'bull');
    return mapBullRow({ ...(data as unknown as BullRow), product_media: (mediaData ?? []) as MediaRow[] });
  }

  async deleteBull(id: string): Promise<void> {
    const { error } = await this.supabase.from('bulls').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async uploadBullMedia(
    bullId: string,
    file: File,
    mediaType: 'image' | 'video' | 'document',
    isCover = false,
  ): Promise<BullMedia> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const ext = file.name.split('.').pop() ?? 'bin';
    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const storagePath = `${tenantId}/bulls/${bullId}/${filename}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await this.supabase
      .from('product_media')
      .insert({
        entity_type: 'bull',
        entity_id: bullId,
        media_type: mediaType,
        storage_path: storagePath,
        mime_type: file.type,
        sort_order: null,
        is_cover: isCover,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapMediaRow(data as unknown as MediaRow);
  }

  async setCoverImage(bullId: string, mediaId: string): Promise<void> {
    const { error } = await this.supabase
      .from('product_media')
      .update({ is_cover: true })
      .eq('id', mediaId)
      .eq('entity_id', bullId);
    if (error) throw new Error(error.message);
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const { data, error: fetchErr } = await this.supabase
      .from('product_media')
      .select('storage_path')
      .eq('id', mediaId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error: storageErr } = await this.supabase.storage
      .from(this.bucket)
      .remove([(data as { storage_path: string }).storage_path]);
    if (storageErr) throw new Error(storageErr.message);

    const { error } = await this.supabase.from('product_media').delete().eq('id', mediaId);
    if (error) throw new Error(error.message);
  }

  getMediaPublicUrl(storagePath: string): string {
    return this.supabase.storage.from(this.bucket).getPublicUrl(storagePath).data.publicUrl;
  }

  getMyBullsForSelect(limit = 100): Observable<{ id: string; name: string }[]> {
    return from(
      this.supabase
        .from('bulls')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(limit),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as { id: string; name: string }[];
      }),
    );
  }

  getCatalogBulls(page = 1, limit = 12): Observable<PaginatedBulls> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    return from(
      this.supabase
        .from('bulls')
        .select(BULL_SELECT, { count: 'exact' })
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .range(from_, to),
    ).pipe(
      switchMap(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as BullRow[]) ?? [];
        const total = count ?? 0;
        if (rows.length === 0) return of({ data: [], total, page, limit, totalPages: Math.ceil(total / limit) });
        return this.fetchBullMedia(rows.map((r) => r.id)).pipe(
          map((mediaMap) => ({
            data: rows.map((r) => mapBullRow({ ...r, product_media: mediaMap.get(r.id) ?? [] })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          })),
        );
      }),
    );
  }
}
