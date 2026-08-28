export interface SellerSegment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSellerSegmentDto {
  code: string;
  name: string;
  description?: string;
}

export type UpdateSellerSegmentDto = Partial<Omit<CreateSellerSegmentDto, 'code'>> & { active?: boolean };

/** Minimal seller shape for the "sellers in this segment" admin view. */
export interface SellerInSegment {
  id: string;
  businessName: string;
  status: string;
}
