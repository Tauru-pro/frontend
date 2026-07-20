import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { ProductService } from '../../../core/services/product.service';
import {
  Product,
  ProductMedia,
  ProductStatus,
  ProductType,
  StrawType,
  STRAW_LABELS,
} from '../../../core/models/product.model';

@Component({
  selector: 'app-product-review',
  imports: [RouterLink, DecimalPipe, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/products"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isBullMode() ? 'Revisión de toro' : 'Revisión de producto' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">Verifica la información antes de aprobar o rechazar</p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-40 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else if (loadError()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {{ loadError() }}
        </div>
      } @else {

        <!-- ── Modo TORO ── -->
        @if (isBullMode() && bull(); as b) {
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Toro</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">En revisión</span>
                </div>
                <h2 class="text-lg font-bold text-gray-900">{{ b.name }}</h2>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-400">
                  @if (b.breedName) { <span>{{ b.breedName }}</span> }
                  @if (b.shortCode) { <span>Código: <span class="font-medium text-gray-600">{{ b.shortCode }}</span></span> }
                </div>
              </div>
            </div>
            @if (bullDescription()) {
              <p class="text-sm text-gray-500 leading-relaxed pt-2 border-t border-gray-50">{{ bullDescription() }}</p>
            }
          </div>

          <!-- Pajillas -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              Pajillas ({{ straws().length }})
            </h3>
            <div class="divide-y divide-gray-50">
              @for (s of straws(); track s.id) {
                <div class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {{ strawLabel(s.strawType) }}
                      </span>
                      <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass(s.status)">
                        {{ statusLabel(s.status) }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">
                      Pedido mínimo: {{ s.minOrderQuantity }} · Stock: {{ s.stockQuantity }}
                    </p>
                  </div>
                  <p class="text-lg font-bold text-gray-900 flex-shrink-0">\${{ s.price | number:'1.0-0' }}</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── Modo INSUMO ── -->
        @if (!isBullMode() && product(); as p) {
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + typeClass(p.productType)">
                    {{ typeLabel(p.productType) }}
                  </span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                    En revisión
                  </span>
                </div>
                <h2 class="text-lg font-bold text-gray-900">{{ p.name }}</h2>
                @if (p.description) {
                  <p class="text-sm text-gray-500 mt-2 leading-relaxed">{{ p.description }}</p>
                }
              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-2xl font-bold text-gray-900">\${{ p.price | number:'1.0-0' }}</p>
                <p class="text-xs text-gray-400 mt-0.5">por unidad</p>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-50">
              <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider">Pedido mínimo</p>
                <p class="text-sm font-semibold text-gray-800 mt-0.5">{{ p.minOrderQuantity }} unidad(es)</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 uppercase tracking-wider">Stock disponible</p>
                <p class="text-sm font-semibold text-gray-800 mt-0.5">{{ p.stockQuantity }} unidad(es)</p>
              </div>
              @if (p.slug) {
                <div>
                  <p class="text-xs text-gray-400 uppercase tracking-wider">Slug</p>
                  <p class="text-sm font-medium text-gray-500 mt-0.5 font-mono truncate">{{ p.slug }}</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Imágenes (toro o producto) -->
        @if (images().length > 0) {
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              Imágenes ({{ images().length }})
            </h3>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
              @for (url of images(); track url; let i = $index) {
                <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-50">
                  <img [src]="url" class="w-full h-full object-cover" [alt]="'Imagen ' + (i + 1)"/>
                  @if (i === coverIndex()) {
                    <span class="absolute top-1 left-1 bg-primary text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                      Portada
                    </span>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Video -->
        @if (video(); as vid) {
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Video</h3>
            <div class="rounded-xl overflow-hidden bg-black">
              <video
                [src]="productService.getMediaPublicUrl(vid.storagePath)"
                controls
                class="w-full max-h-96 object-contain"
              ></video>
            </div>
          </div>
        }

        <!-- Documento (PDF genética) -->
        @if (document(); as doc) {
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Prueba genética</h3>
              <a
                [href]="productService.getMediaPublicUrl(doc.storagePath)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Abrir en nueva pestaña
              </a>
            </div>
            <p class="text-xs text-gray-400 -mt-2">{{ doc.storagePath.split('/').pop() ?? 'Prueba genética.pdf' }}</p>
            <iframe
              [src]="safePdfUrl(doc.storagePath)"
              class="w-full rounded-xl border border-gray-100 h-[640px]"
              title="Prueba genética"
            ></iframe>
          </div>
        }

        <!-- Decisión -->
        @if (canDecide()) {
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h3 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Decisión</h3>

            @if (isBullMode()) {
              <p class="text-xs text-gray-500 -mt-2">La decisión se aplica a las {{ pendingStraws().length }} pajilla(s) pendientes del toro.</p>
            }

            @if (actionError()) {
              <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {{ actionError() }}
              </div>
            }

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                (click)="approve()"
                [disabled]="processing()"
                class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 disabled:opacity-60 transition-colors"
              >
                @if (processing()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                } @else {
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                }
                Aprobar
              </button>
              <button
                type="button"
                (click)="openModal('CHANGES_REQUESTED')"
                [disabled]="processing()"
                class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
                Solicitar cambios
              </button>
              <button
                type="button"
                (click)="openModal('REJECTED')"
                [disabled]="processing()"
                class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Rechazar
              </button>
            </div>
          </div>
        } @else {
          <div class="bg-gray-50 rounded-2xl border border-gray-100 p-6 text-center">
            <p class="text-sm text-gray-400">No hay elementos pendientes de revisión.</p>
          </div>
        }

      }
    </div>

    <!-- Modal notas (rechazo / cambios) -->
    @if (modal()) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
          <div class="flex items-center gap-3">
            <div [class]="'w-10 h-10 rounded-xl flex items-center justify-center ' + (modal()!.action === 'REJECTED' ? 'bg-red-50' : 'bg-orange-50')">
              <svg [class]="'w-5 h-5 ' + (modal()!.action === 'REJECTED' ? 'text-red-500' : 'text-orange-500')" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">
              {{ modal()!.action === 'REJECTED' ? 'Rechazar' : 'Solicitar cambios' }}
            </h3>
          </div>
          @if (isBullMode()) {
            <p class="text-xs text-gray-500 -mt-1">Se aplicará a las {{ pendingStraws().length }} pajilla(s) pendientes del toro.</p>
          }
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              {{ modal()!.action === 'REJECTED' ? 'Motivo del rechazo' : 'Cambios solicitados' }}
              <span class="text-red-400">*</span>
            </label>
            <textarea
              [formField]="notesForm.notes"
              rows="4"
              placeholder="Describe el motivo..."
              class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
            ></textarea>
            @if (notesForm.notes().touched() && notesForm.notes().errors().length) {
              <p class="text-red-400 text-xs mt-1.5">{{ notesForm.notes().errors()[0].message }}</p>
            }
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              (click)="modal.set(null)"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="submitModal()"
              [disabled]="processing()"
              [class]="'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-60 transition-colors ' +
                (modal()!.action === 'REJECTED' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600')"
            >
              @if (processing()) { Guardando... }
              @else { {{ modal()!.action === 'REJECTED' ? 'Rechazar' : 'Solicitar cambios' }} }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export default class ProductReviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  productService = inject(ProductService);

  mode = signal<'bull' | 'supply'>('supply');
  product = signal<Product | null>(null);
  straws = signal<Product[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  processing = signal(false);
  modal = signal<{ action: 'REJECTED' | 'CHANGES_REQUESTED' } | null>(null);

  notesModel = signal({ notes: '' });
  notesForm = form(this.notesModel, (s) => {
    required(s.notes, { message: 'El motivo es requerido' });
  });

  isBullMode = computed(() => this.mode() === 'bull');
  bull = computed(() => this.straws()[0]?.bull ?? null);
  bullDescription = computed(() => this.straws()[0]?.description ?? null);
  pendingStraws = computed(() => this.straws().filter((s) => s.status === 'PENDING_VALIDATION'));
  mediaList = computed<ProductMedia[]>(() =>
    this.isBullMode() ? this.straws()[0]?.media ?? [] : this.product()?.media ?? [],
  );
  canDecide = computed(() =>
    this.isBullMode() ? this.pendingStraws().length > 0 : this.product()?.status === 'PENDING_VALIDATION',
  );

  ngOnInit(): void {
    const bullId = this.route.snapshot.paramMap.get('bullId');
    const id = this.route.snapshot.paramMap.get('id');
    if (bullId) {
      this.mode.set('bull');
      this.productService.getStrawProductsByBull(bullId).subscribe({
        next: (straws) => {
          this.straws.set(straws);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudo cargar el toro. Intenta de nuevo.');
          this.loading.set(false);
        },
      });
    } else if (id) {
      this.mode.set('supply');
      this.productService.getProduct(id).subscribe({
        next: (p) => {
          this.product.set(p);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudo cargar el producto. Intenta de nuevo.');
          this.loading.set(false);
        },
      });
    } else {
      this.loadError.set('No se pudo cargar el producto. Intenta de nuevo.');
      this.loading.set(false);
    }
  }

  /** Ids de productos pendientes objetivo de una acción. */
  private targetIds(): string[] {
    return this.isBullMode()
      ? this.pendingStraws().map((s) => s.id)
      : this.product()
        ? [this.product()!.id]
        : [];
  }

  async approve(): Promise<void> {
    this.processing.set(true);
    this.actionError.set(null);
    try {
      await this.productService.validateProducts(this.targetIds(), 'APPROVED');
      this.router.navigate(['/admin/products']);
    } catch {
      this.actionError.set('No se pudo aprobar. Intenta de nuevo.');
      this.processing.set(false);
    }
  }

  openModal(action: 'REJECTED' | 'CHANGES_REQUESTED'): void {
    this.notesModel.set({ notes: '' });
    this.modal.set({ action });
  }

  submitModal(): void {
    const m = this.modal();
    if (!m) return;
    submit(this.notesForm, async () => {
      const notes = this.notesModel().notes.trim();
      this.processing.set(true);
      this.actionError.set(null);
      try {
        await this.productService.validateProducts(this.targetIds(), m.action, notes);
        this.router.navigate(['/admin/products']);
      } catch {
        this.actionError.set('No se pudo procesar la acción. Intenta de nuevo.');
        this.processing.set(false);
      }
    });
  }

  images(): string[] {
    const sorted = [...this.mediaList()]
      .filter((m) => m.mediaType === 'image')
      .sort((a, b) => (b.isCover ? 1 : 0) - (a.isCover ? 1 : 0));
    return sorted.map((m) => this.productService.getMediaPublicUrl(m.storagePath));
  }

  coverIndex(): number {
    const sorted = [...this.mediaList()]
      .filter((m) => m.mediaType === 'image')
      .sort((a, b) => (b.isCover ? 1 : 0) - (a.isCover ? 1 : 0));
    return sorted.findIndex((m) => m.isCover);
  }

  video(): ProductMedia | null {
    return this.mediaList().find((m) => m.mediaType === 'video') ?? null;
  }

  document(): ProductMedia | null {
    return this.mediaList().find((m) => m.mediaType === 'document') ?? null;
  }

  safePdfUrl(storagePath: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.productService.getMediaPublicUrl(storagePath),
    );
  }

  typeLabel(type: ProductType): string {
    return type === 'STRAW' ? 'Pajilla' : 'Insumo';
  }

  typeClass(type: ProductType): string {
    return type === 'STRAW' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700';
  }

  strawLabel(type: StrawType | null): string {
    return type ? STRAW_LABELS[type] : '';
  }

  statusClass(status: ProductStatus): string {
    const map: Record<ProductStatus, string> = {
      ACTIVE: 'bg-green-50 text-green-700',
      DRAFT: 'bg-gray-100 text-gray-600',
      SUSPENDED: 'bg-red-50 text-red-500',
      OUT_OF_STOCK: 'bg-orange-50 text-orange-600',
      PENDING_VALIDATION: 'bg-yellow-50 text-yellow-700',
      REJECTED: 'bg-red-50 text-red-700',
      CHANGES_REQUESTED: 'bg-orange-50 text-orange-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  statusLabel(status: ProductStatus): string {
    const map: Record<ProductStatus, string> = {
      ACTIVE: 'Activo',
      DRAFT: 'Borrador',
      SUSPENDED: 'Suspendido',
      OUT_OF_STOCK: 'Sin stock',
      PENDING_VALIDATION: 'En revisión',
      REJECTED: 'Rechazado',
      CHANGES_REQUESTED: 'Con observaciones',
    };
    return map[status] ?? status;
  }
}
