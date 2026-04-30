import { Bull } from "./bull.model";

export type ProductType = 'STRAW' | 'SUPPLIES';
export type ProductOrigin = 'NATIONAL' | 'IMPORTED';
export type RegistrationType = 'PURO' | 'COMERCIAL';
export type ProductStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'ACTIVE' | 'SUSPENDED' | 'OUT_OF_STOCK';

export interface ProductMedia {
  id: string;
  mediaType: 'image' | 'video';
  s3Key: string;
  s3Bucket: string;
  mimeType: string;
  sortOrder: number | null;
  isCover: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  sellerId: string;
  productType: ProductType;
  name: string;
  description: string | null;
  price: number;
  bull: Bull
  stockQuantity: number;
  stockReserved: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
  stockQuantity: number;
}

export type UpdateProductDto = Partial<Omit<CreateProductDto, 'productType'>>;
