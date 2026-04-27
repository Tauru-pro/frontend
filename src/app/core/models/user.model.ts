
export interface UserProfile {
  id: string;
  email: string;
  role: string;
  status: string;
  oauthProviders: OauthProvider[];
  sellerProfile?: string;
  buyerProfile?: BuyerProfile;
}

export interface BuyerProfile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  city?: string;
  herdSize?: string;
  buyerType?: string;
  whatsapp?: string;
}

export interface OauthProvider {
  provider: string;
  providerUserId: string;
}