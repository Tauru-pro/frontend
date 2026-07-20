-- ============================================================================
-- 0014_seller_documents
-- Documentos legales del vendedor (RUT + certificado de representación legal).
-- Se guardan en un bucket PRIVADO `seller-documents` (datos sensibles / PII) y
-- se referencian en la tabla `seller_documents`, relacionada al vendedor por
-- seller_id (= seller_profiles.id = claim `tenant_id` del JWT).
--
-- Convención de ruta de storage: <tenant_id>/legal/<doc_type>-<timestamp>.<ext>
-- => el primer segmento es el tenant_id, validado contra el claim del JWT.
-- ============================================================================

-- Tabla de documentos ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     uuid        NOT NULL REFERENCES public.seller_profiles (id) ON DELETE CASCADE,
  doc_type      text        NOT NULL CHECK (doc_type IN ('RUT', 'LEGAL_REP')),
  storage_path  text        NOT NULL UNIQUE,
  mime_type     text,
  original_name text,
  status        text        NOT NULL DEFAULT 'PENDING_REVIEW'
                            CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, doc_type)
);

ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;

-- El vendedor gestiona (lee/escribe) solo los documentos de su propio tenant.
DROP POLICY IF EXISTS "seller_documents_owner" ON public.seller_documents;
CREATE POLICY "seller_documents_owner" ON public.seller_documents
  FOR ALL
  USING      (seller_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (seller_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- El admin puede leer todos los documentos (revisión futura).
DROP POLICY IF EXISTS "seller_documents_admin_read" ON public.seller_documents;
CREATE POLICY "seller_documents_admin_read" ON public.seller_documents
  FOR SELECT
  USING ((auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN'));

-- Bucket privado ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-documents',
  'seller-documents',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Escritura: solo dentro de la carpeta del propio tenant.
DROP POLICY IF EXISTS "seller_documents_insert_own_tenant" ON storage.objects;
CREATE POLICY "seller_documents_insert_own_tenant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seller-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

DROP POLICY IF EXISTS "seller_documents_update_own_tenant" ON storage.objects;
CREATE POLICY "seller_documents_update_own_tenant" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'seller-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  )
  WITH CHECK (
    bucket_id = 'seller-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

DROP POLICY IF EXISTS "seller_documents_delete_own_tenant" ON storage.objects;
CREATE POLICY "seller_documents_delete_own_tenant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'seller-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

-- Lectura: NO pública. Solo el dueño (su tenant) o un admin (para servir signed URLs).
DROP POLICY IF EXISTS "seller_documents_read_own_or_admin" ON storage.objects;
CREATE POLICY "seller_documents_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'seller-documents'
    AND (
      (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
      OR (auth.jwt() ->> 'user_role') IN ('ADMIN', 'SUPER_ADMIN')
    )
  );
