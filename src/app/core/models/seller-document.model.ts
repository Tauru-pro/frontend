export type SellerDocumentType = 'RUT' | 'LEGAL_REP';

export type SellerDocumentStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface SellerDocument {
  id: string;
  sellerId: string;
  docType: SellerDocumentType;
  storagePath: string;
  mimeType: string | null;
  originalName: string | null;
  status: SellerDocumentStatus;
  uploadedAt: string;
}

/** Etiquetas legibles de cada documento legal. */
export const SELLER_DOCUMENT_LABELS: Record<SellerDocumentType, string> = {
  RUT: 'RUT',
  LEGAL_REP: 'Certificado de representación legal',
};
