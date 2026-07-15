export type TermsAudience = 'BUYER' | 'SELLER';

export interface TermsDocument {
  id: string;
  audience: TermsAudience;
  version: string;
  content: string;
}
