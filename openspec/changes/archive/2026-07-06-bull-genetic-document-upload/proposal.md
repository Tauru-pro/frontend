## Why

El paso de "Archivos" en el formulario de registro/edición de toros solo admite imágenes y video. Las pruebas genéticas (DEP reports, resultados de evaluaciones de asociaciones ganaderas) son documentos PDF que los compradores necesitan para evaluar objetivamente la calidad genética antes de adquirir pajillas.

## What Changes

- `bull-form.component.ts`: añadir sección "Documentos" en el paso 2 (Archivos) con un área de drag-and-drop para subir 1 PDF como prueba genética; gestionar `pendingDocument` y `existingDocuments` signals análogos a los de imágenes; incluir el documento en la secuencia de subida de `uploadFiles()`.
- `upload.model.ts`: extender `MediaType` con `'document'` y `MimeType` con `'application/pdf'`.
- Sin cambios en backend ni en Supabase Storage: `BullService.uploadBullMedia()` ya acepta `mediaType: 'document'` y el bucket `bull-media` está configurado.

## Capabilities

### New Capabilities

*(ninguna — es una extensión del flujo existente de registro de toros)*

### Modified Capabilities

- `bull-management`: el registro y edición de un toro ahora permite adjuntar un documento PDF de prueba genética en la sección de archivos.

## Impact

- **Archivos modificados**: `src/app/features/seller/bulls/bull-form.component.ts`, `src/app/core/models/upload.model.ts`.
- **Sin cambios en**: `BullService`, esquema de BD, Supabase Storage (bucket, RLS, MIME policies), rutas SSR.
- **Sin migraciones**: la columna `media_type` en `bull_media` ya permite `'document'`.
