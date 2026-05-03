import { City } from "./location.model";

export type UserRole = 'ADMIN' | 'SELLER' | 'BUYER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type SellerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  oauthProviders: OauthProvider[];
  sellerProfile?: SellerProfile;
  buyerProfile?: BuyerProfile;
}

export interface BuyerProfile {
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
  contactPhone?: string;
  logoKey: string;
  city?: City;
  address?: string;
  status?: SellerStatus;
}

export interface OauthProvider {
  provider: string;
  providerUserId: string;
}

export interface CreateUserDto {
  email: string;
  fullName: string;
  role: UserRole;
}

export interface UpdateUserDto {
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
}

export interface UpdateSellerProfileDto {
  bussinesName?: string;
  contactPhone?: string;
  cityId?: string;
  address?: string;
  logoKey?: string;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
}