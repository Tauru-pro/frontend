export type ProductType = 'STRAW' | 'SUPPLIES';
export type StrawType = 'SEXADO_MALE' | 'SEXADO_FEMALE' | 'CONVENTIONAL';
export type ProductStatus =
  | 'DRAFT'
  | 'PENDING_VALIDATION'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'OUT_OF_STOCK'
  | 'SUSPENDED';

export interface ProductMedia {
  id: string;
  entityType: 'bull' | 'product';
  entityId: string;
  mediaType: 'image' | 'video' | 'document';
  storagePath: string;
  mimeType: string | null;
  sortOrder: number | null;
  isCover: boolean;
  createdAt: string;
}

export interface ProductBull {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  tenantId: string;
  productType: ProductType;
  name: string;
  slug: string | null;
  description: string | null;
  price: number;
  bullId: string | null;
  bull: ProductBull | null;
  strawType: StrawType | null;
  minOrderQuantity: number;
  readonly stockQuantity: number;
  status: ProductStatus;
  validationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  media: ProductMedia[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  productType: ProductType;
  name: string;
  description?: string;
  price: number;
  bullId?: string;
  strawType?: StrawType;
  minOrderQuantity?: number;
}

export type UpdateProductDto = Partial<Omit<CreateProductDto, 'productType'>>;
