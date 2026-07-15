import { City } from "./location.model";

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SELLER' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type SellerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  sellerProfile?: SellerProfile;
  customerProfile?: CustomerProfile;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  city?: City;
  herdSize?: string;
  buyerType?: string;
  whatsapp?: string;
}

export interface SellerProfile {
  id: string;
  userId: string;
  bussinesName: string;
  description?: string;
  contactPhone?: string;
  logoKey: string;
  city?: City;
  address?: string;
  status?: SellerStatus;
  email?: string;
  createdAt?: string;
}

export interface CreateUserDto {
  email: string;
  fullName: string;
  role: 'SELLER' | 'SUPER_ADMIN';
}

export interface UpdateUserDto {
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
}

export interface UpdateSellerProfileDto {
  bussinesName?: string;
  description?: string;
  contactPhone?: string;
  cityId?: string;
  address?: string;
  logoKey?: string;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
}