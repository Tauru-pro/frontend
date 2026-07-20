-- ============================================================================
-- 0013_product_media_storage_bucket
-- Crea el bucket de storage `product-media` (usado por bull.service /
-- product.service para imágenes, video y PDF de prueba genética) y sus
-- policies de RLS en storage.objects, con escritura scoped por tenant.
--
-- Convención de rutas usada por el frontend:
--   <tenant_id>/bulls/<bull_id>/<archivo>
--   <tenant_id>/products/<product_id>/<archivo>
-- => el primer segmento de la ruta es el tenant_id, y se valida contra el
--    claim `tenant_id` del JWT (inyectado por custom_access_token_hook).
-- ============================================================================

-- Bucket público (lectura vía URL pública) con MIME types y límite de 50 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Escritura: el vendedor autenticado solo puede subir/editar/eliminar dentro
-- de la carpeta de su propio tenant.
DROP POLICY IF EXISTS "product_media_insert_own_tenant" ON storage.objects;
CREATE POLICY "product_media_insert_own_tenant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

DROP POLICY IF EXISTS "product_media_update_own_tenant" ON storage.objects;
CREATE POLICY "product_media_update_own_tenant" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  )
  WITH CHECK (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

DROP POLICY IF EXISTS "product_media_delete_own_tenant" ON storage.objects;
CREATE POLICY "product_media_delete_own_tenant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

-- Lectura pública (el bucket es público; los archivos se sirven vía URL pública).
DROP POLICY IF EXISTS "product_media_public_read" ON storage.objects;
CREATE POLICY "product_media_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-media');
