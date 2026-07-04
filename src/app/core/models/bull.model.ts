import { Breed } from './breed.model';
import { PaginatedResponse, ProductMedia, StrawType } from './product.model';

export type BullOrigin = 'NATIONAL' | 'IMPORTED';
export type BullRegistrationType = 'PURO' | 'COMERCIAL';
export type BullStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

export type BullMedia = ProductMedia;

export interface Bull {
  id: string;
  tenantId: string;
  name: string;
  breedId: string;
  breed: Breed;
  origin: BullOrigin;
  registrationType: BullRegistrationType | null;
  code: string | null;
  description: string | null;
  status: BullStatus;
  createdAt: string;
  updatedAt: string;
  media: BullMedia[];
}

export interface CreateBullDto {
  name: string;
  breedId: string;
  origin: BullOrigin;
  registrationType?: BullRegistrationType;
  code?: string;
  description?: string;
}

export type UpdateBullDto = Partial<CreateBullDto>;

export type PaginatedBulls = PaginatedResponse<Bull>;

export type { StrawType };
