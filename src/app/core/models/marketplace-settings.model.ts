export interface MarketplaceSettings {
  id: string;
  name: string;
  commissionPercentage: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  logoKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMarketplaceSettingsDto {
  name?: string;
  commissionPercentage?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}
