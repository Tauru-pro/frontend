import { PaginatedResponse } from './product.model';

export type BullOrigin = 'NATIONAL' | 'IMPORTED';
export type BullRegistrationType = 'PURO' | 'COMERCIAL';
export type BullStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
export type StrawType = 'SEXADO_MALE' | 'SEXADO_FEMALE' | 'CONVENTIONAL';
export type StrawStatus = 'PENDING_VALIDATION' | 'OUT_OF_STOCK' | 'SUSPENDED' | 'ACTIVE' | 'DRAFT';

export interface BullMedia {
  id: string;
  mediaType: 'image' | 'video';
  s3Key: string;
  s3Bucket: string;
  mimeType: string;
  sortOrder: number | null;
  isCover: boolean;
  createdAt: string;
}

export interface BullStraw {
  id: string;
  strawType: StrawType;
  price: number;
  minOrderQuantity: number;
  stockQuantity: number;
  status: StrawStatus;
  createdAt: string;
}

export interface Bull {
  id: string;
  sellerId: string;
  name: string;
  breed: string;
  origin: BullOrigin;
  registrationType: BullRegistrationType | null;
  code: string | null;
  description: string | null;
  status: BullStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  straws: BullStraw[];
  media: BullMedia[];
}

export interface CreateBullDto {
  name: string;
  breed: string;
  origin: BullOrigin;
  registrationType?: BullRegistrationType;
  code?: string;
  description?: string;
}

export type UpdateBullDto = Partial<CreateBullDto>;

export interface CreateBullStrawDto {
  strawType: StrawType;
  price: number;
  stockQuantity: number;
  minOrderQuantity: number;
}

export interface UpdateBullStrawDto {
  price?: number;
  stockQuantity?: number;
  minOrderQuantity?: number;
  status?: StrawStatus;
}

export type PaginatedBulls = PaginatedResponse<Bull>;
