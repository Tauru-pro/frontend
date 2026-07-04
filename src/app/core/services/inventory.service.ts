import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';
import { getJwtClaim } from '../auth/jwt-claims';
import {
  CreateMovementDto,
  InventoryItem,
  InventoryMovement,
  MovementType,
  PaginatedInventory,
  UpdateInventoryItemDto,
} from '../models/inventory.model';

interface InventoryItemRow {
  id: string;
  tenant_id: string;
  product_id: string;
  branch_id: string;
  current_stock: number;
  min_stock_quantity: number;
  created_at: string;
  updated_at: string;
  products: { id: string; name: string; product_type: string } | null;
  branches: { id: string; name: string } | null;
}

interface InventoryMovementRow {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  product_id: string;
  branch_id: string;
  movement_type: MovementType;
  quantity: number;
  delta: number;
  resulting_balance: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

function mapItemRow(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    branchId: row.branch_id,
    currentStock: row.current_stock,
    minStockQuantity: row.min_stock_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    product: row.products
      ? { id: row.products.id, name: row.products.name, productType: row.products.product_type }
      : undefined,
    branch: row.branches ? { id: row.branches.id, name: row.branches.name } : undefined,
  };
}

function mapMovementRow(row: InventoryMovementRow): InventoryMovement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    inventoryItemId: row.inventory_item_id,
    productId: row.product_id,
    branchId: row.branch_id,
    movementType: row.movement_type,
    quantity: row.quantity,
    delta: row.delta,
    resultingBalance: row.resulting_balance,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

const ITEM_SELECT = `
  id, tenant_id, product_id, branch_id, current_stock, min_stock_quantity, created_at, updated_at,
  products(id, name, product_type),
  branches(id, name)
`.trim();

const MOVEMENT_SELECT = `
  id, tenant_id, inventory_item_id, product_id, branch_id,
  movement_type, quantity, delta, resulting_balance, notes, created_by, created_at
`.trim();

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private supabase = inject(SupabaseClientService).client;

  getMyInventoryItems(page = 1, limit = 20): Observable<PaginatedInventory> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    return from(
      this.supabase
        .from('inventory_items')
        .select(ITEM_SELECT, { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(from_, to),
    ).pipe(
      map(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as InventoryItemRow[]) ?? [];
        const total = count ?? 0;
        return {
          data: rows.map(mapItemRow),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }

  getInventoryItem(id: string): Observable<InventoryItem> {
    return from(
      this.supabase.from('inventory_items').select(ITEM_SELECT).eq('id', id).single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapItemRow(data as unknown as InventoryItemRow);
      }),
    );
  }

  getMovements(inventoryItemId: string, page = 1, limit = 50): Observable<InventoryMovement[]> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    return from(
      this.supabase
        .from('inventory_movements')
        .select(MOVEMENT_SELECT)
        .eq('inventory_item_id', inventoryItemId)
        .order('created_at', { ascending: false })
        .range(from_, to),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as unknown as InventoryMovementRow[]).map(mapMovementRow);
      }),
    );
  }

  async createMovement(dto: CreateMovementDto): Promise<InventoryMovement> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const delta = this.movementDelta(dto.movementType, dto.quantity);

    // inventory_item_id and resulting_balance are set by the DB trigger
    const { data, error } = await this.supabase
      .from('inventory_movements')
      .insert({
        tenant_id: tenantId,
        product_id: dto.productId,
        branch_id: dto.branchId,
        movement_type: dto.movementType,
        quantity: dto.quantity,
        delta,
        resulting_balance: 0,
        notes: dto.notes ?? null,
      })
      .select(MOVEMENT_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return mapMovementRow(data as unknown as InventoryMovementRow);
  }

  async updateMinStock(itemId: string, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .update({ min_stock_quantity: dto.minStockQuantity })
      .eq('id', itemId)
      .select(ITEM_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return mapItemRow(data as unknown as InventoryItemRow);
  }

  getAllInventoryItems(page = 1, limit = 50): Observable<PaginatedInventory> {
    const from_ = (page - 1) * limit;
    const to = from_ + limit - 1;
    return from(
      this.supabase
        .from('inventory_items')
        .select(ITEM_SELECT, { count: 'exact' })
        .order('tenant_id', { ascending: true })
        .range(from_, to),
    ).pipe(
      map(({ data, error, count }) => {
        if (error) throw error;
        const rows = (data as unknown as InventoryItemRow[]) ?? [];
        const total = count ?? 0;
        return {
          data: rows.map(mapItemRow),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }

  private movementDelta(type: MovementType, quantity: number): number {
    switch (type) {
      case 'ENTRY':
      case 'CANCELLATION':
        return quantity;
      case 'EXIT':
      case 'SALE':
        return -quantity;
      case 'ADJUSTMENT':
        return quantity;
    }
  }
}
