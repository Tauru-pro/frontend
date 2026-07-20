export type ProductType = 'STRAW' | 'SUPPLIES';
export type StrawType = 'SEXADO_MALE' | 'SEXADO_FEMALE' | 'CONVENTIONAL';

/** Orden canónico de los tipos de pajilla (para iterar en formularios/listas). */
export const STRAW_TYPES: readonly StrawType[] = ['CONVENTIONAL', 'SEXADO_MALE', 'SEXADO_FEMALE'];

/** Etiquetas legibles de cada tipo de pajilla. Fuente única para formularios, listas y marketplace. */
export const STRAW_LABELS: Record<StrawType, string> = {
  CONVENTIONAL: 'Convencional',
  SEXADO_MALE: 'Sexado Macho',
  SEXADO_FEMALE: 'Sexado Hembra',
};

export function strawLabel(type: StrawType | null | undefined): string {
  return type ? STRAW_LABELS[type] : '';
}
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
  breedId?: string;
  breedName?: string;
  shortCode?: string | null;
}

export interface CatalogFilters {
  productType?: ProductType;
  breedId?: string;
  minPrice?: number;
  maxPrice?: number;
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

/**
 * Agrupación de las pajillas (productos STRAW) de un mismo toro para la lista del vendedor.
 * `media` es la media del toro (imágenes/video/PDF), no de los productos.
 */
export interface StrawListing {
  bull: ProductBull;
  straws: Product[];
  media: ProductMedia[];
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
