export type MovementType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'SALE' | 'CANCELLATION';

export interface InventoryItem {
  id: string;
  tenantId: string;
  productId: string;
  branchId: string;
  currentStock: number;
  minStockQuantity: number;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string; productType: string };
  branch?: { id: string; name: string };
}

export interface InventoryMovement {
  id: string;
  tenantId: string;
  inventoryItemId: string;
  productId: string;
  branchId: string;
  movementType: MovementType;
  quantity: number;
  delta: number;
  resultingBalance: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateMovementDto {
  productId: string;
  branchId: string;
  movementType: MovementType;
  quantity: number;
  notes?: string;
}

export interface UpdateInventoryItemDto {
  minStockQuantity: number;
}

export interface PaginatedInventory {
  data: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
