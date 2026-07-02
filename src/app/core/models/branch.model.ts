export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string | null;
  latitude?: number;
  longitude?: number;
  businessHours?: string;
  isMain: boolean;
  status: BranchStatus;
  city?: {
    id: string;
    name: string;
    state: { id: string; name: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchDto {
  name: string;
  cityId: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  businessHours?: string;
}

export type UpdateBranchDto = Partial<CreateBranchDto>;
