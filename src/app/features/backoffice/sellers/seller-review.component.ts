import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { UserService } from '../../../core/services/user.service';
import { SellerDocumentService } from '../../../core/services/seller-document.service';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { SellerProfile, SellerStatus } from '../../../core/models/user.model';
import { SellerSegment } from '../../../core/models/seller-segment.model';
import { firstValueFrom } from 'rxjs';
import {
  SellerDocument,
  SellerDocumentStatus,
  SellerDocumentType,
  SELLER_DOCUMENT_LABELS,
} from '../../../core/models/seller-document.model';

@Component({
  selector: 'app-seller-review',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/sellers"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">Revisión de vendedor</h1>
          <p class="text-sm text-gray-500 mt-0.5">Verifica los documentos legales antes de aprobar</p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          <div class="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
          <div class="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
        </div>
      } @else if (loadError()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ loadError() }}
        </div>
      } @else if (seller(); as s) {

        <div class="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-gray-900 truncate">{{ s.bussinesName || '—' }}</h2>
            <p class="text-sm text-gray-400 mt-0.5">{{ s.email ?? '—' }}</p>
          </div>
          <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + sellerStatusClass(s.status)">
            {{ sellerStatusLabel(s.status) }}
          </span>
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
          <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Segmento comercial</h3>
          <p class="text-xs text-gray-400">
            El segmento determina la comisión de la plataforma para este vendedor. Es obligatorio antes de verificarlo.
          </p>
          <div class="flex items-center gap-3">
            <select
              (change)="selectedSegmentId.set($any($event.target).value)"
              class="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
            >
              <option value="" [selected]="!selectedSegmentId()">Sin asignar</option>
              @for (seg of segments(); track seg.id) {
                <option [value]="seg.id" [selected]="seg.id === selectedSegmentId()">{{ seg.name }}</option>
              }
            </select>
            <button
              type="button"
              (click)="assignSegment(s.id)"
              [disabled]="assigningSegment() || !selectedSegmentId() || selectedSegmentId() === (s.segmentId ?? '')"
              class="btn-primary px-4 py-2.5 text-sm disabled:opacity-60"
            >
              @if (assigningSegment()) { Guardando... } @else { Asignar }
            </button>
          </div>
        </div>

        @if (actionError()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ actionError() }}
          </div>
        }

        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Documentos legales</h3>

          @for (docType of docTypes; track docType) {
            <div class="border border-gray-50 rounded-xl p-4">
              @if (documentFor(docType); as doc) {
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-800">{{ labels[docType] }}</p>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span class="text-xs text-gray-500 truncate max-w-[220px]">{{ doc.originalName ?? 'documento' }}</span>
                      <span [class]="'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ' + docStatusClass(doc.status)">
                        {{ docStatusLabel(doc.status) }}
                      </span>
                    </div>
                    @if (doc.status === 'REJECTED' && doc.rejectionReason) {
                      <p class="text-xs text-red-600 mt-1.5">{{ doc.rejectionReason }}</p>
                    }
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      (click)="view(doc)"
                      class="px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      Ver
                    </button>
                    @if (doc.status === 'PENDING_REVIEW') {
                      <button
                        type="button"
                        (click)="approve(doc)"
                        [disabled]="processing()"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-60 transition-colors"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        (click)="openRejectModal(doc)"
                        [disabled]="processing()"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors"
                      >
                        Rechazar
                      </button>
                    }
                  </div>
                </div>
              } @else {
                <p class="text-sm text-gray-400">{{ labels[docType] }} — aún no subido por el vendedor.</p>
              }
            </div>
          }
        </div>
      }
    </div>

    @if (rejectModal(); as target) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">Rechazar {{ labels[target.docType] }}</h3>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              Motivo del rechazo <span class="text-red-400">*</span>
            </label>
            <textarea
              [formField]="reasonForm.reason"
              rows="4"
              placeholder="Describe el motivo..."
              class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
            ></textarea>
            @if (reasonForm.reason().touched() && reasonForm.reason().errors().length) {
              <p class="text-red-400 text-xs mt-1.5">{{ reasonForm.reason().errors()[0].message }}</p>
            }
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              (click)="rejectModal.set(null)"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="submitReject()"
              [disabled]="processing()"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-60 transition-colors"
            >
              @if (processing()) { Guardando... } @else { Rechazar }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export default class SellerReviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private documentService = inject(SellerDocumentService);
  private segmentService = inject(SellerSegmentService);

  protected readonly labels = SELLER_DOCUMENT_LABELS;
  protected readonly docTypes: SellerDocumentType[] = ['RUT', 'LEGAL_REP'];

  seller = signal<SellerProfile | null>(null);
  documents = signal<SellerDocument[]>([]);
  segments = signal<SellerSegment[]>([]);
  selectedSegmentId = signal<string>('');
  assigningSegment = signal(false);
  loading = signal(true);
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  processing = signal(false);
  rejectModal = signal<SellerDocument | null>(null);

  reasonModel = signal({ reason: '' });
  reasonForm = form(this.reasonModel, (s) => {
    required(s.reason, { message: 'El motivo es requerido' });
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loadError.set('No se pudo cargar el vendedor.');
      this.loading.set(false);
      return;
    }
    try {
      this.segments.set(await firstValueFrom(this.segmentService.getAll()));
    } catch (err) {
      console.error('Failed to load seller_segments:', err);
      this.actionError.set(
        `No se pudieron cargar los segmentos disponibles: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await this.load(id);
  }

  async assignSegment(sellerId: string): Promise<void> {
    const segmentId = this.selectedSegmentId();
    if (!segmentId) return;
    this.assigningSegment.set(true);
    this.actionError.set(null);
    try {
      await this.segmentService.assignSellerSegment(sellerId, segmentId);
      await this.load(sellerId);
    } catch (err) {
      console.error('assignSegment failed:', err);
      const detail = err instanceof Error ? err.message : String(err);
      this.actionError.set(`No se pudo asignar el segmento: ${detail}`);
    } finally {
      this.assigningSegment.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [seller, documents] = await Promise.all([
        this.userService.getSellerById(id),
        this.documentService.getDocumentsForSeller(id),
      ]);
      this.seller.set(seller);
      this.documents.set(documents);
      this.selectedSegmentId.set(seller.segmentId ?? '');
    } catch {
      this.loadError.set('No se pudo cargar el vendedor. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  documentFor(docType: SellerDocumentType): SellerDocument | undefined {
    return this.documents().find((d) => d.docType === docType);
  }

  async view(doc: SellerDocument): Promise<void> {
    try {
      const url = await this.documentService.getSignedUrl(doc.storagePath);
      window.open(url, '_blank', 'noopener');
    } catch {
      this.actionError.set('No se pudo abrir el documento. Intenta de nuevo.');
    }
  }

  async approve(doc: SellerDocument): Promise<void> {
    this.processing.set(true);
    this.actionError.set(null);
    try {
      await this.documentService.approveDocument(doc.id);
      await this.load(doc.sellerId);
    } catch {
      this.actionError.set('No se pudo aprobar el documento. Intenta de nuevo.');
    } finally {
      this.processing.set(false);
    }
  }

  openRejectModal(doc: SellerDocument): void {
    this.reasonModel.set({ reason: '' });
    this.rejectModal.set(doc);
  }

  submitReject(): void {
    const doc = this.rejectModal();
    if (!doc) return;
    submit(this.reasonForm, async () => {
      const reason = this.reasonModel().reason.trim();
      this.processing.set(true);
      this.actionError.set(null);
      try {
        await this.documentService.rejectDocument(doc.id, reason);
        this.rejectModal.set(null);
        await this.load(doc.sellerId);
      } catch {
        this.actionError.set('No se pudo rechazar el documento. Intenta de nuevo.');
      } finally {
        this.processing.set(false);
      }
    });
  }

  sellerStatusClass(status?: SellerStatus): string {
    const map: Record<SellerStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      PENDING: 'bg-yellow-50 text-yellow-700',
      SUSPENDED: 'bg-red-50 text-red-500',
    };
    return status ? (map[status] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-500';
  }

  sellerStatusLabel(status?: SellerStatus): string {
    const map: Record<SellerStatus, string> = {
      ACTIVE: 'Verificado',
      PENDING: 'Pendiente de verificación',
      SUSPENDED: 'Suspendido',
    };
    return status ? (map[status] ?? status) : '—';
  }

  docStatusClass(status: SellerDocumentStatus): string {
    const map: Record<SellerDocumentStatus, string> = {
      PENDING_REVIEW: 'bg-yellow-50 text-yellow-700',
      APPROVED: 'bg-green-50 text-green-700',
      REJECTED: 'bg-red-50 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  docStatusLabel(status: SellerDocumentStatus): string {
    const map: Record<SellerDocumentStatus, string> = {
      PENDING_REVIEW: 'En revisión',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
    };
    return map[status] ?? status;
  }
}
