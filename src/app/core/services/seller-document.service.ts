import { inject, Injectable } from '@angular/core';
import { SupabaseClientService } from '../auth/supabase-client';
import { getJwtClaim } from '../auth/jwt-claims';
import {
  SellerDocument,
  SellerDocumentStatus,
  SellerDocumentType,
} from '../models/seller-document.model';

interface SellerDocumentRow {
  id: string;
  seller_id: string;
  doc_type: SellerDocumentType;
  storage_path: string;
  mime_type: string | null;
  original_name: string | null;
  status: SellerDocumentStatus;
  rejection_reason: string | null;
  uploaded_at: string;
}

function mapRow(row: SellerDocumentRow): SellerDocument {
  return {
    id: row.id,
    sellerId: row.seller_id,
    docType: row.doc_type,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    originalName: row.original_name,
    status: row.status,
    rejectionReason: row.rejection_reason,
    uploadedAt: row.uploaded_at,
  };
}

@Injectable({ providedIn: 'root' })
export class SellerDocumentService {
  private supabase = inject(SupabaseClientService).client;
  private readonly bucket = 'seller-documents';

  /** Documentos legales del vendedor actual (RLS lo scopa a su tenant). */
  async getMyDocuments(): Promise<SellerDocument[]> {
    const { data, error } = await this.supabase
      .from('seller_documents')
      .select('*')
      .order('doc_type', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SellerDocumentRow[]).map(mapRow);
  }

  /**
   * Sube (o reemplaza) un documento legal al bucket privado `seller-documents` y
   * registra/actualiza su fila en `seller_documents`. Si ya existía uno del mismo
   * tipo, borra el objeto anterior del storage.
   */
  async uploadDocument(docType: SellerDocumentType, file: File): Promise<SellerDocument> {
    const tenantId = await getJwtClaim(this.supabase, 'tenant_id');
    if (!tenantId) throw new Error('NO_TENANT');

    const { data: existing } = await this.supabase
      .from('seller_documents')
      .select('storage_path')
      .eq('seller_id', tenantId)
      .eq('doc_type', docType)
      .maybeSingle();

    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${tenantId}/legal/${docType.toLowerCase()}-${Date.now()}.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await this.supabase
      .from('seller_documents')
      .upsert(
        {
          seller_id: tenantId,
          doc_type: docType,
          storage_path: storagePath,
          mime_type: file.type,
          original_name: file.name,
          status: 'PENDING_REVIEW',
          rejection_reason: null,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id,doc_type' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Limpieza best-effort del objeto anterior.
    const oldPath = (existing as { storage_path: string } | null)?.storage_path;
    if (oldPath && oldPath !== storagePath) {
      await this.supabase.storage.from(this.bucket).remove([oldPath]);
    }

    return mapRow(data as SellerDocumentRow);
  }

  /** URL firmada temporal para visualizar un documento del bucket privado. */
  async getSignedUrl(storagePath: string, expiresIn = 300): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, expiresIn);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  /** Documentos legales de un vendedor específico (ADMIN/SUPER_ADMIN, vía RLS). */
  async getDocumentsForSeller(sellerId: string): Promise<SellerDocument[]> {
    const { data, error } = await this.supabase
      .from('seller_documents')
      .select('*')
      .eq('seller_id', sellerId)
      .order('doc_type', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SellerDocumentRow[]).map(mapRow);
  }

  /**
   * Decisión de revisión del admin (aprobar / rechazar) sobre un documento legal.
   * Se ejecuta en la edge function `seller-document-validate`, que actualiza el
   * documento con service_role, recalcula la verificación del vendedor y notifica
   * por correo.
   */
  private async validateDocument(
    documentId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ): Promise<void> {
    const { error } = await this.supabase.functions.invoke('seller-document-validate', {
      body: { documentId, decision, reason },
    });
    if (error) throw new Error(error.message);
  }

  async approveDocument(documentId: string): Promise<void> {
    return this.validateDocument(documentId, 'APPROVED');
  }

  async rejectDocument(documentId: string, reason: string): Promise<void> {
    return this.validateDocument(documentId, 'REJECTED', reason);
  }

  /** Cantidad de documentos en PENDING_REVIEW, para el badge del sidebar del admin. */
  async getPendingReviewCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('seller_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING_REVIEW');
    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}
