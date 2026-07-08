## Context

El formulario `bull-form.component.ts` ya tiene un paso 2 ("Archivos") con dos secciones: Imágenes (máx. 3) y Video (máx. 1). Cada sección usa signals `pendingX` / `existingX` y un `input[type=file]` hidden accionado por un botón/área drop. `BullService.uploadBullMedia()` ya acepta `mediaType: 'document'`; el bucket de Supabase Storage acepta el path `{tenantId}/bulls/{bullId}/{filename}` para cualquier tipo. Solo falta el UI y extender los tipos de `upload.model.ts`.

## Goals / Non-Goals

**Goals:**
- Añadir sección "Prueba Genética (PDF)" en el paso 2 del formulario de toros.
- Aceptar 1 PDF (máximo), admitir tanto selección por clic como drag-and-drop.
- Mostrar el documento existente al editar un toro con PDF ya cargado (enlace para abrir + botón eliminar).
- Incluir el PDF en la barra de progreso de subida junto a imágenes y video.
- Extender `upload.model.ts` para que los tipos reflejen la realidad del sistema.

**Non-Goals:**
- Previsualización inline del PDF (complejo, bajo valor; con un enlace es suficiente).
- Múltiples documentos PDF por toro.
- Validación del contenido del PDF (solo validación de MIME type).
- Cambios en el detalle público del toro (`bull-detail.component`) para mostrar el PDF — eso es un change separado.

## Decisions

### 1 — Un PDF máximo por toro
**Decisión**: `pendingDocument: signal<PendingFile | null>(null)` y `existingDocuments` filtrado de `existingMedia`. Si ya hay un PDF existente, el área de drop se reemplaza por la fila de "documento existente" (enlace + eliminar). Si hay un `pendingDocument`, se muestra el nombre del archivo + botón quitar.

**Rationale**: Una prueba genética por toro es el caso de uso dominante. Añadir soporte de múltiples documentos complica el UI y el modelo sin valor claro en MVP.

### 2 — Extensión de `upload.model.ts` en lugar de tipos locales
**Decisión**: añadir `'document'` a `MediaType` y `'application/pdf'` a `MimeType` directamente en el model compartido.

**Rationale**: `PendingFile` en `bull-form.component.ts` usa `MimeType` del modelo, y `BullService.uploadBullMedia()` ya acepta `mediaType: 'document'`. Mantener los tipos consistentes evita casts y `as any`.

### 3 — Sin previsualización iframe del PDF
**Decisión**: para el documento existente se muestra solo el nombre del archivo (derivado del `storage_path`) y un enlace que abre la URL pública en nueva pestaña.

**Rationale**: los iframes PDF tienen comportamiento heterogéneo entre navegadores/dispositivos; el enlace directo es más fiable y menos código.

### 4 — Sección "Documentos" al final del paso 2
**Decisión**: la nueva sección aparece debajo de la sección "Video", antes de la barra de progreso y los botones de navegación. El orden refleja la importancia: imagen (visual) → video → documento técnico.

## Risks / Trade-offs

- **Nombre del archivo en Storage**: el `storage_path` contiene el nombre generado con timestamp + UUID (e.g. `1720000000000-abc12.pdf`). Para mostrar el nombre al usuario se usa el nombre original del `File` (`pendingDocument().file.name`) para el pending, y para el existente se muestra el último segmento del path o una etiqueta genérica "Prueba genética.pdf".
- **MIME spoofing**: validamos `file.type === 'application/pdf'` en el cliente. El backend/Supabase no hace validación adicional de contenido — riesgo bajo en un marketplace B2B donde los vendedores están autenticados.
