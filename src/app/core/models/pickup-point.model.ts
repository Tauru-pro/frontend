export interface PickupPoint {
  id: string;
  name: string;
  city: { id: string; name: string };
  address: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePickupPointDto {
  name: string;
  cityId: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export type UpdatePickupPointDto = Partial<CreatePickupPointDto>;
