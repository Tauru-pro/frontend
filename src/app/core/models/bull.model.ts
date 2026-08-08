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
  shortCode: string | null;
  description: string | null;
  status: BullStatus;
  /** Marcado por el vendedor para aparecer en "Semen Destacado". Uno por vendedor. */
  isFeatured: boolean;
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
  shortCode?: string;
  description?: string;
}

export type UpdateBullDto = Partial<CreateBullDto>;

export type PaginatedBulls = PaginatedResponse<Bull>;

export type { StrawType };
