export type BreedPurpose = 'MILK' | 'MEAT';

export interface Breed {
  id: string;
  name: string;
  purpose: BreedPurpose;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBreedDto {
  name: string;
  purpose: BreedPurpose;
}

export type UpdateBreedDto = Partial<CreateBreedDto>;
