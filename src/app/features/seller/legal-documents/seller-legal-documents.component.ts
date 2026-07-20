import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SellerDocumentService } from '../../../core/services/seller-document.service';
import {
  SellerDocument,
  SellerDocumentType,
  SELLER_DOCUMENT_LABELS,
} from '../../../core/models/seller-document.model';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-seller-legal-documents',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto py-2 space-y-6">

      <div class="flex items-center gap-3">
        <a routerLink="/seller/settings"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">Documentos legales</h1>
          <p class="text-sm text-gray-500 mt-0.5">Acredítate como proveedor</p>
        </div>
      </div>

      <!-- Explicación / consentimiento -->
      <div class="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex gap-4">
        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div class="text-sm text-gray-600 leading-relaxed">
          <p class="font-semibold text-gray-800 mb-1">Para empezar a vender debes acreditarte</p>
          Sube los documentos legales que te acreditan como vendedor: tu <strong>RUT</strong> y el
          <strong>certificado de representación legal</strong> de tu empresa. Tus documentos son privados y
          solo el equipo de TAUVO puede revisarlos. Puedes hacerlo ahora u <strong>omitir y subirlos más
          tarde</strong> desde tu configuración.
        </div>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{{ errorMsg() }}</div>
      }

      @if (loading()) {
        <div class="space-y-4">
          <div class="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
          <div class="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
        </div>
      } @else {
        <!-- RUT -->
        <div class="bg-white rounded-2xl border border-gray-100 p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-gray-800">{{ labels['RUT'] }}</h2>
              @if (uploaded('RUT'); as doc) {
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span class="text-xs text-gray-600 truncate max-w-[220px]">{{ doc.originalName ?? 'documento' }}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 text-yellow-700">En revisión</span>
                </div>
              } @else if (pending('RUT'); as f) {
                <div class="flex items-center gap-2 mt-1.5">
                  <span class="text-xs text-primary truncate max-w-[220px]">{{ f.name }}</span>
                  <button type="button" (click)="clearPending('RUT')" class="text-xs text-gray-400 hover:text-red-500">Quitar</button>
                </div>
              } @else {
                <p class="text-xs text-gray-400 mt-1">Aún no lo has subido · PDF o imagen</p>
              }
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              @if (uploaded('RUT')) {
                <button type="button" (click)="view('RUT')" class="px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">Ver</button>
              }
              <button type="button" (click)="pickRut()" class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {{ uploaded('RUT') || pending('RUT') ? 'Reemplazar' : 'Subir' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Certificado de representación legal -->
        <div class="bg-white rounded-2xl border border-gray-100 p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-gray-800">{{ labels['LEGAL_REP'] }}</h2>
              @if (uploaded('LEGAL_REP'); as doc) {
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span class="text-xs text-gray-600 truncate max-w-[220px]">{{ doc.originalName ?? 'documento' }}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 text-yellow-700">En revisión</span>
                </div>
              } @else if (pending('LEGAL_REP'); as f) {
                <div class="flex items-center gap-2 mt-1.5">
                  <span class="text-xs text-primary truncate max-w-[220px]">{{ f.name }}</span>
                  <button type="button" (click)="clearPending('LEGAL_REP')" class="text-xs text-gray-400 hover:text-red-500">Quitar</button>
                </div>
              } @else {
                <p class="text-xs text-gray-400 mt-1">Aún no lo has subido · PDF o imagen</p>
              }
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              @if (uploaded('LEGAL_REP')) {
                <button type="button" (click)="view('LEGAL_REP')" class="px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">Ver</button>
              }
              <button type="button" (click)="pickLegal()" class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {{ uploaded('LEGAL_REP') || pending('LEGAL_REP') ? 'Reemplazar' : 'Subir' }}
              </button>
            </div>
          </div>
        </div>

        <input #rutInput type="file" [accept]="accept" class="hidden" (change)="onFileSelected('RUT', $event)" />
        <input #legalInput type="file" [accept]="accept" class="hidden" (change)="onFileSelected('LEGAL_REP', $event)" />

        <div class="flex flex-col sm:flex-row gap-3 justify-end pt-2">
          <button type="button" (click)="skip()" [disabled]="saving()"
            class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40">
            Omitir y subir más tarde
          </button>
          <button type="button" (click)="save()" [disabled]="saving() || !hasPending()"
            class="btn-primary px-6 py-2.5 text-sm disabled:opacity-50">
            {{ saving() ? 'Guardando…' : 'Guardar y continuar' }}
          </button>
        </div>
      }
    </div>
  `,
})
export default class SellerLegalDocumentsComponent implements OnInit {
  private service = inject(SellerDocumentService);
  private router = inject(Router);

  protected readonly labels = SELLER_DOCUMENT_LABELS;
  protected readonly accept = ACCEPT;

  private rutInputRef = viewChild<ElementRef<HTMLInputElement>>('rutInput');
  private legalInputRef = viewChild<ElementRef<HTMLInputElement>>('legalInput');

  loading = signal(true);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  documents = signal<SellerDocument[]>([]);
  private pendingFiles = signal<Partial<Record<SellerDocumentType, File>>>({});

  async ngOnInit(): Promise<void> {
    try {
      this.documents.set(await this.service.getMyDocuments());
    } catch {
      this.errorMsg.set('No se pudieron cargar tus documentos. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  uploaded(type: SellerDocumentType): SellerDocument | undefined {
    return this.documents().find((d) => d.docType === type);
  }

  pending(type: SellerDocumentType): File | undefined {
    return this.pendingFiles()[type];
  }

  hasPending(): boolean {
    return Object.keys(this.pendingFiles()).length > 0;
  }

  pickRut(): void {
    this.rutInputRef()?.nativeElement.click();
  }

  pickLegal(): void {
    this.legalInputRef()?.nativeElement.click();
  }

  onFileSelected(type: SellerDocumentType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      this.errorMsg.set('Formato no permitido. Sube un PDF o una imagen (JPG, PNG, WEBP).');
      return;
    }
    this.errorMsg.set(null);
    this.pendingFiles.update((p) => ({ ...p, [type]: file }));
  }

  clearPending(type: SellerDocumentType): void {
    this.pendingFiles.update((p) => {
      const next = { ...p };
      delete next[type];
      return next;
    });
  }

  async view(type: SellerDocumentType): Promise<void> {
    const doc = this.uploaded(type);
    if (!doc) return;
    try {
      const url = await this.service.getSignedUrl(doc.storagePath);
      window.open(url, '_blank', 'noopener');
    } catch {
      this.errorMsg.set('No se pudo abrir el documento. Intenta de nuevo.');
    }
  }

  async save(): Promise<void> {
    const entries = Object.entries(this.pendingFiles()) as [SellerDocumentType, File][];
    if (entries.length === 0) {
      this.router.navigate(['/seller']);
      return;
    }
    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      for (const [type, file] of entries) {
        await this.service.uploadDocument(type, file);
      }
      this.router.navigate(['/seller']);
    } catch {
      this.errorMsg.set('No se pudieron guardar los documentos. Intenta de nuevo.');
      this.saving.set(false);
    }
  }

  skip(): void {
    this.router.navigate(['/seller']);
  }
}
