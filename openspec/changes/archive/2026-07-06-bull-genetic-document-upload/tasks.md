## 1. Tipos — upload.model.ts

- [x] 1.1 Añadir `'document'` a `MediaType` (`export type MediaType = 'image' | 'video' | 'document'`) en `src/app/core/models/upload.model.ts`
- [x] 1.2 Añadir `'application/pdf'` a `MimeType` en `src/app/core/models/upload.model.ts`

## 2. Estado del componente — bull-form.component.ts

- [x] 2.1 Añadir `'document'` a los tipos de `mediaType` en la interfaz `PendingFile` (cambiar `mediaType: 'image' | 'video'` a `mediaType: 'image' | 'video' | 'document'`)
- [x] 2.2 Añadir constante `const PDF_MIME_TYPES: MimeType[] = ['application/pdf']` junto a las otras constantes de MIME
- [x] 2.3 Declarar signal `pendingDocument = signal<PendingFile | null>(null)` y `viewChild` `pdfInputRef = viewChild<ElementRef<HTMLInputElement>>('pdfInput')` en la clase del componente
- [x] 2.4 Añadir computed `existingDocuments = computed(() => this.existingMedia().filter(m => m.mediaType === 'document'))`

## 3. Métodos del componente — bull-form.component.ts

- [x] 3.1 Añadir método `openPdfPicker()` que hace click en `pdfInputRef()?.nativeElement`
- [x] 3.2 Añadir método `onPdfSelected(event: Event)` que lee el archivo, llama a `addDocumentFile()` y resetea el input
- [x] 3.3 Añadir método `onPdfDrop(event: DragEvent)` que previene default y llama a `addDocumentFile()` con el primer PDF del dataTransfer
- [x] 3.4 Añadir método privado `addDocumentFile(file: File)` que valida MIME (`application/pdf`), revoca objectURL anterior si existe, y actualiza `pendingDocument`
- [x] 3.5 Añadir método `removeDocument()` que revoca el objectURL y pone `pendingDocument` a null
- [x] 3.6 Actualizar `ngOnDestroy()` para revocar el objectURL del `pendingDocument()` si existe
- [x] 3.7 Actualizar `uploadFiles()` para incluir `pendingDocument()` en `allFiles` (junto a las imágenes y el video)

## 4. Template del componente — bull-form.component.ts

- [x] 4.1 Añadir sección "Prueba Genética (PDF)" debajo de la sección "Video" en el paso 2, que muestre:
  - Si existe documento en `existingDocuments()`: nombre derivado del path (último segmento) + enlace que abre la URL pública en nueva pestaña + botón eliminar que llama a `deleteExistingMedia(doc.id)`
  - Si existe `pendingDocument()`: nombre del archivo (`pendingDocument()!.file.name`) + botón quitar que llama a `removeDocument()`
  - Si no hay documento (ni existente ni pendiente): área drag-and-drop con texto "Haz clic para subir o arrastra tu PDF aquí" que llama a `openPdfPicker()` y maneja `onPdfDrop`
  - `input#pdfInput type="file" accept="application/pdf"` hidden, referenciado como `#pdfInput`, con `(change)="onPdfSelected($event)"`

## 5. Verificación

- [x] 5.1 Ejecutar `ng build` y corregir errores de compilación; verificar que el build SSR termine sin errores
