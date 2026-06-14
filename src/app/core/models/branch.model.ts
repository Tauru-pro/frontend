export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface Branch {
  id: string;
  sellerId: string;
  name: string;
  address: string;
  phone: string | null;
  isMain: boolean;
  status: BranchStatus;
  city: {
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
}

export type UpdateBranchDto = Partial<CreateBranchDto>;
