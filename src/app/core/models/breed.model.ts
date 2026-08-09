export type BreedPurpose = 'MILK' | 'MEAT';

export interface Breed {
  id: string;
  name: string;
  /** Derivado del nombre por un trigger; es lo que viaja en `/catalog?breed=`. */
  slug: string;
  purpose: BreedPurpose;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBreedDto {
  name: string;
  purpose: BreedPurpose;
}

export type UpdateBreedDto = Partial<CreateBreedDto>;
