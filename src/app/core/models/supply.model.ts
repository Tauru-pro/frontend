export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type SupplyStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'OUT_OF_STOCK';

export interface SupplyMedia {
  id: string;
  mediaType: 'image' | 'video';
  s3Key: string;
  s3Bucket: string;
  mimeType: string;
  sortOrder: number | null;
  isCover: boolean;
  createdAt: string;
}

export interface Supply {
  id: string;
  sellerId: string;
  name: string;
  description: string | null;
  price: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountLabel: string | null;
  discountExpiresAt: string | null;
  stockQuantity: number;
  status: SupplyStatus;
  media: SupplyMedia[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplyDto {
  name: string;
  price: number;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  discountLabel?: string;
  discountExpiresAt?: string;
  stockQuantity?: number;
}

export type UpdateSupplyDto = Partial<CreateSupplyDto>;
