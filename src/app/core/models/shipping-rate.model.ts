export interface ShippingRate {
  id: string;
  origin: { id: string; name: string };
  destination: { id: string; name: string };
  baseRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShippingRateDto {
  originId: string;
  destinationId: string;
  baseRate: number;
}

export type UpdateShippingRateDto = Partial<CreateShippingRateDto>;
