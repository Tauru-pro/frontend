import { inject, Injectable } from '@angular/core';
import { catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { getJwtClaim } from '../auth/jwt-claims';
import {
  CatalogFilters,
  CreateProductDto,
  PaginatedResponse,
  Product,
  ProductMedia,
  ProductStatus,
  ProductType,
  StrawType,
  UpdateProductDto,
} from '../models/product.model';

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

interface ProductRow {
  id: string;
  tenant_id: string;
  product_type: ProductType;
  name: string;
  slug: string | null;
  description: string | null;
  price: number;
  bull_id: string | null;
  straw_type: StrawType | null;
  min_order_quantity: number;
  stock_quantity: number;
  status: ProductStatus;
  validation_notes: string | null;
  created_at: string;
  updated_at: string;
  bulls: { id: string; name: string; breed_id?: string; breeds?: { id: string; name: string } | null } | null;
  product_media: MediaRow[];
}

function mapMediaRow(row: MediaRow): ProductMedia {
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

function mapProductRow(row: ProductRow): Product {
  const bullRaw = row.bulls ?? null;
  const bull = bullRaw
    ? {
        id: bullRaw.id,
        name: bullRaw.name,
        breedId: bullRaw.breed_id,
        breedName: (bullRaw.breeds as { id: string; name: string } | null | undefined)?.name,
      }
    : null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    productType: row.product_type,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    bullId: row.bull_id,
    bull,
    strawType: row.straw_type,
    minOrderQuantity: row.min_order_quantity,
    stockQuantity: row.stock_quantity,
    status: row.status,
    validationNotes: row.validation_notes,
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

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

const PRODUCT_SELECT = `
  id, tenant_id, product_type, name, slug, description, price,
  bull_id, straw_type, min_order_quantity, stock_quantity,
  status, validation_notes, created_at, updated_at,
  bulls(id, name, breed_id, breeds(id, name))
`.trim();

const CATALOG_SELECT_BASE = `
  id, tenant_id, product_type, name, slug, description, price,
  bull_id, straw_type, min_order_quantity, stock_quantity,
  status, created_at, updated_at
`.trim();

const MEDIA_SELECT = `id, entity_type, entity_id, media_type, storage_path, mime_type, sort_order, is_cover, created_at`;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private supabase = inject(SupabaseClientService).client;
  private readonly bucket = 'product-media';

  private fetchProductMedia(ids: string[]): Observable<Map<string, MediaRow[]>> {
    if (ids.length === 0) return of(new Map());
    return from(
      this.supabase
        .from('product_media')
        .select(MEDIA_SELECT)
        .in('entity_id', ids)
        .eq('entity_type', 'product'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return groupMediaById((data ?? []) as MediaRow[]);
      }),
    );
  }

  getMyProducts(
    page = 1,
    limit = 10,
    productType?: ProductType,
    status?: ProductStatus,
  ): Observable<PaginatedResponse<Product>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    let query = this.supabase
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_, to);
    if (productType) query = query.eq('product_type', productType);
    if (status) query = query.eq('status', status);

    return from(query).pipe(
      switchMap(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as ProductRow[]) ?? [];
        const total = count ?? 0;
        if (rows.length === 0) return of({ data: [], total, page, limit, totalPages: Math.ceil(total / limit) });
        return this.fetchProductMedia(rows.map((r) => r.id)).pipe(
          map((mediaMap) => ({
            data: rows.map((r) => mapProductRow({ ...r, product_media: mediaMap.get(r.id) ?? [] })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          })),
        );
      }),
    );
  }

  getPublicCatalog(
    page = 1,
    limit = 12,
    filters: CatalogFilters = {},
  ): Observable<PaginatedResponse<Product>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    const { productType, breedId, minPrice, maxPrice } = filters;

    const bullJoin = breedId
      ? 'bulls!inner(id, name, breed_id, breeds(id, name))'
      : 'bulls(id, name, breed_id, breeds(id, name))';
    const selectStr = `${CATALOG_SELECT_BASE}, ${bullJoin}`;

    let query = this.supabase
      .from('products')
      .select(selectStr, { count: 'exact' })
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .range(from_, to);

    if (productType) query = query.eq('product_type', productType);
    if (breedId) query = (query as any).eq('bulls.breed_id', breedId);
    if (minPrice != null) query = query.gte('price', minPrice);
    if (maxPrice != null) query = query.lte('price', maxPrice);

    return from(query).pipe(
      switchMap(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as ProductRow[]) ?? [];
        const total = count ?? 0;
        if (rows.length === 0) return of({ data: [], total, page, limit, totalPages: Math.ceil(total / limit) });
        return this.fetchProductMedia(rows.map((r) => r.id)).pipe(
          map((mediaMap) => ({
            data: rows.map((r) => mapProductRow({ ...r, product_media: mediaMap.get(r.id) ?? [] })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          })),
        );
      }),
    );
  }

  getProduct(id: string): Observable<Product> {
    return from(
      this.supabase.from('products').select(PRODUCT_SELECT).eq('id', id).single(),
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        const row = data as unknown as ProductRow;
        const entityIds = [id, ...(row.bull_id ? [row.bull_id] : [])];
        return from(
          this.supabase
            .from('product_media')
            .select(MEDIA_SELECT)
            .in('entity_id', entityIds),
        ).pipe(
          map(({ data: mediaData, error: mediaError }) => {
            if (mediaError) throw mediaError;
            return mapProductRow({ ...row, product_media: (mediaData ?? []) as MediaRow[] });
          }),
        );
      }),
    );
  }

  getAllPendingValidation(
    page = 1,
    limit = 20,
  ): Observable<PaginatedResponse<Product>> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    return from(
      this.supabase
        .from('products')
        .select(PRODUCT_SELECT, { count: 'exact' })
        .eq('status', 'PENDING_VALIDATION')
        .order('updated_at', { ascending: true })
        .range(from_, to),
    ).pipe(
      switchMap(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as ProductRow[]) ?? [];
        const total = count ?? 0;
        if (rows.length === 0) return of({ data: [], total, page, limit, totalPages: Math.ceil(total / limit) });
        return this.fetchProductMedia(rows.map((r) => r.id)).pipe(
          map((mediaMap) => ({
            data: rows.map((r) => mapProductRow({ ...r, product_media: mediaMap.get(r.id) ?? [] })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          })),
        );
      }),
    );
  }

  getPendingCount(): Observable<number> {
    return this.getAllPendingValidation(1, 1).pipe(
      map(res => res.total),
      catchError(() => of(0)),
    );
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const { data, error } = await this.supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        product_type: dto.productType,
        name: dto.name,
        slug: toSlug(dto.name),
        description: dto.description ?? null,
        price: dto.price,
        bull_id: dto.bullId ?? null,
        straw_type: dto.strawType ?? null,
        min_order_quantity: dto.minOrderQuantity ?? 1,
      })
      .select(PRODUCT_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return mapProductRow({ ...(data as unknown as ProductRow), product_media: [] });
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const row: Record<string, unknown> = {};
    if (dto.name !== undefined) { row['name'] = dto.name; row['slug'] = toSlug(dto.name); }
    if (dto.description !== undefined) row['description'] = dto.description ?? null;
    if (dto.price !== undefined) row['price'] = dto.price;
    if (dto.bullId !== undefined) row['bull_id'] = dto.bullId ?? null;
    if (dto.strawType !== undefined) row['straw_type'] = dto.strawType ?? null;
    if (dto.minOrderQuantity !== undefined) row['min_order_quantity'] = dto.minOrderQuantity;


    const { data, error } = await this.supabase
      .from('products')
      .update(row)
      .eq('id', id)
      .select(PRODUCT_SELECT)
      .single();

    if (error) throw new Error(error.message);

    const { data: mediaData } = await this.supabase
      .from('product_media')
      .select(MEDIA_SELECT)
      .eq('entity_id', id)
      .eq('entity_type', 'product');
    return mapProductRow({ ...(data as unknown as ProductRow), product_media: (mediaData ?? []) as MediaRow[] });
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await this.supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async submitForValidation(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .update({ status: 'PENDING_VALIDATION' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async resubmitAfterChanges(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .update({ status: 'PENDING_VALIDATION' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async approveProduct(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .update({ status: 'ACTIVE', validation_notes: null })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async rejectProduct(id: string, notes: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .update({ status: 'REJECTED', validation_notes: notes })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async requestChanges(id: string, notes: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .update({ status: 'CHANGES_REQUESTED', validation_notes: notes })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async uploadProductMedia(
    productId: string,
    file: File,
    mediaType: 'image' | 'video' | 'document',
    isCover = false,
  ): Promise<ProductMedia> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const ext = file.name.split('.').pop() ?? 'bin';
    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const storagePath = `${tenantId}/products/${productId}/${filename}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await this.supabase
      .from('product_media')
      .insert({
        entity_type: 'product',
        entity_id: productId,
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

  async setCoverImage(productId: string, mediaId: string): Promise<void> {
    const { error } = await this.supabase
      .from('product_media')
      .update({ is_cover: true })
      .eq('id', mediaId)
      .eq('entity_id', productId);
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
}
