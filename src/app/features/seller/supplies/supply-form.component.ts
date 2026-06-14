import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  required,
  minLength,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { SupplyService } from '../../../core/services/supply.service';
import {
  CreateSupplyDto,
  DiscountType,
  SupplyMedia,
  UpdateSupplyDto,
} from '../../../core/models/supply.model';
import { MimeType } from '../../../core/models/upload.model';
import { environment } from '../../../../environments/environment';

interface SupplyFormModel {
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  discountType: DiscountType | '';
  discountValue: number;
  discountLabel: string;
  discountExpiresAt: string;
}

interface PendingFile {
  file: File;
  preview: string;
  mediaType: 'image' | 'video';
  mimeType: MimeType;
}

const IMAGE_MIME_TYPES: MimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

@Component({
  selector: 'app-supply-form',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/supplies"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar insumo' : 'Nuevo insumo' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEditMode() ? 'Modifica los datos del insumo' : 'Completa los datos para publicar tu insumo' }}
          </p>
        </div>
      </div>

      <!-- Step indicator -->
      <div class="flex items-center px-1">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >
            @if (currentStep() > 1) {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            } @else { 1 }
          </div>
          <span class="text-sm font-medium" [class]="currentStep() >= 1 ? 'text-gray-800' : 'text-gray-400'">
            Información básica
          </span>
        </div>
        <div class="flex-1 mx-4 h-px transition-all" [class]="currentStep() > 1 ? 'bg-primary' : 'bg-gray-200'"></div>
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >2</div>
          <span class="text-sm font-medium" [class]="currentStep() >= 2 ? 'text-gray-800' : 'text-gray-400'">
            Imágenes
          </span>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {
        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- ===== STEP 1 ===== -->
          @if (currentStep() === 1) {

            <!-- Información básica -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información básica</h2>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre del insumo <span class="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  [formField]="supplyForm.name"
                  placeholder="Ej. Pistola de transferencia de embriones"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (supplyForm.name().touched() && supplyForm.name().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ supplyForm.name().errors()[0].message }}
                  </p>
                }
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                <textarea
                  [formField]="supplyForm.description"
                  rows="3"
                  placeholder="Describe las características del insumo..."
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <!-- Precio y stock -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Precio y stock</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Precio (COP) <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    [formField]="supplyForm.price"
                    placeholder="0"
                    step="0.01"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (supplyForm.price().touched() && supplyForm.price().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5">{{ supplyForm.price().errors()[0].message }}</p>
                  }
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Cantidad en stock</label>
                  <input
                    type="number"
                    [formField]="supplyForm.stockQuantity"
                    placeholder="0"
                    step="1"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            <!-- Descuento (opcional) -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Descuento</h2>
                <span class="text-xs text-gray-400">Opcional</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Tipo de descuento</label>
                  <select
                    [formField]="supplyForm.discountType"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
                  >
                    <option value="">Sin descuento</option>
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FIXED_AMOUNT">Monto fijo ($)</option>
                  </select>
                </div>

                @if (hasDiscount()) {
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">
                      Valor del descuento <span class="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      [formField]="supplyForm.discountValue"
                      placeholder="0"
                      step="0.01"
                      class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                }
              </div>

              @if (hasDiscount()) {
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Etiqueta del descuento</label>
                    <input
                      type="text"
                      [formField]="supplyForm.discountLabel"
                      placeholder="Ej. Oferta de temporada"
                      class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Vence el</label>
                    <input
                      type="datetime-local"
                      [formField]="supplyForm.discountExpiresAt"
                      class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              }
            </div>

            <div class="flex gap-3 justify-end pb-6">
              <a
                routerLink="/seller/supplies"
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </a>
              <button
                type="button"
                (click)="goToStep2()"
                class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                Siguiente
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          }

          <!-- ===== STEP 2 ===== -->
          @if (currentStep() === 2) {

            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Imágenes</h2>
                  <p class="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP o AVIF</p>
                </div>
                @if (existingImages().length + pendingImages().length > 0) {
                  <span class="text-xs text-gray-400">
                    {{ existingImages().length + pendingImages().length }} imagen(es)
                  </span>
                }
              </div>

              @if (existingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (media of existingImages(); track media.id) {
                    <div class="relative aspect-square group">
                      <img
                        [src]="getMediaUrl(media.s3Key)"
                        class="w-full h-full object-cover rounded-xl"
                        alt="Imagen del insumo"
                      />
                      @if (media.isCover) {
                        <span class="absolute top-1 left-1 bg-primary text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                          Portada
                        </span>
                      }
                      <div class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        @if (!media.isCover) {
                          <button
                            type="button"
                            (click)="setCover(media.id)"
                            title="Establecer como portada"
                            class="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                          >
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                          </button>
                        }
                        <button
                          type="button"
                          (click)="deleteExistingMedia(media.id)"
                          title="Eliminar"
                          class="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }

              @if (pendingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (img of pendingImages(); track img.preview; let i = $index) {
                    <div class="relative aspect-square group">
                      <img [src]="img.preview" class="w-full h-full object-cover rounded-xl" alt="Vista previa"/>
                      @if (i === 0 && existingImages().length === 0) {
                        <span class="absolute top-1 left-1 bg-primary/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                          Portada
                        </span>
                      }
                      <button
                        type="button"
                        (click)="removeImage(i)"
                        class="absolute top-1 right-1 w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              }

              <div
                class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                (dragover)="$event.preventDefault()"
                (drop)="onImageDrop($event)"
                (click)="openImagePicker()"
              >
                <svg class="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p class="text-sm text-gray-500">
                  <span class="font-medium text-primary">Haz clic para subir</span> o arrastra tus imágenes aquí
                </p>
                <p class="text-xs text-gray-400 mt-1">Puedes seleccionar varias imágenes a la vez</p>
              </div>
              <input
                #imageInput
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                class="hidden"
                (change)="onImagesSelected($event)"
              />
            </div>

            @if (saving() && uploadProgress() > 0) {
              <div class="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-600 font-medium">Subiendo imágenes...</span>
                  <span class="text-primary font-semibold">{{ uploadProgress() }}%</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full transition-all duration-300"
                    [style.width.%]="uploadProgress()"
                  ></div>
                </div>
              </div>
            }

            @if (errorMsg()) {
              <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {{ errorMsg() }}
              </div>
            }

            <div class="flex gap-3 justify-between pb-6">
              <button
                type="button"
                (click)="currentStep.set(1)"
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Atrás
              </button>
              <button
                type="submit"
                [disabled]="saving()"
                class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                @if (saving()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {{ uploadProgress() > 0 ? 'Subiendo imágenes...' : 'Guardando...' }}
                } @else {
                  {{ isEditMode() ? 'Guardar cambios' : 'Crear insumo' }}
                }
              </button>
            </div>
          }

        </form>
      }
    </div>
  `,
})
export default class SupplyFormComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supplyService = inject(SupplyService);

  currentStep = signal(1);
  isEditMode = signal(false);
  supplyId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  uploadProgress = signal(0);
  pendingImages = signal<PendingFile[]>([]);
  existingMedia = signal<SupplyMedia[]>([]);

  imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageInput');

  existingImages = computed(() => this.existingMedia().filter(m => m.mediaType === 'image'));
  hasDiscount = computed(() => this.model().discountType !== '');

  model = signal<SupplyFormModel>({
    name: '',
    description: '',
    price: 0,
    stockQuantity: 0,
    discountType: '',
    discountValue: 0,
    discountLabel: '',
    discountExpiresAt: '',
  });

  supplyForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    minLength(s.name, 3, { message: 'El nombre debe tener al menos 3 caracteres' });
    required(s.price, { message: 'El precio es requerido' });
    validate(s.price, ({ value }) =>
      (value() as number) < 0
        ? { kind: 'min', message: 'El precio no puede ser negativo' }
        : undefined,
    );
    validate(s.stockQuantity, ({ value }) =>
      (value() as number) < 0
        ? { kind: 'min', message: 'El stock no puede ser negativo' }
        : undefined,
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.supplyId.set(id);
      this.loadForEdit(id);
    }
  }

  ngOnDestroy(): void {
    this.pendingImages().forEach(f => URL.revokeObjectURL(f.preview));
  }

  getMediaUrl(key: string): string {
    return `${environment.cdn}/${key}`;
  }

  goToStep2(): void {
    submit(this.supplyForm, async () => {
      this.currentStep.set(2);
    });
  }

  openImagePicker(): void {
    this.imageInputRef()?.nativeElement.click();
  }

  onImagesSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    this.addImageFiles(Array.from(files));
    (event.target as HTMLInputElement).value = '';
  }

  onImageDrop(event: DragEvent): void {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f =>
      IMAGE_MIME_TYPES.includes(f.type as MimeType),
    );
    this.addImageFiles(files);
  }

  removeImage(index: number): void {
    const files = [...this.pendingImages()];
    URL.revokeObjectURL(files[index].preview);
    files.splice(index, 1);
    this.pendingImages.set(files);
  }

  deleteExistingMedia(mediaId: string): void {
    const id = this.supplyId();
    if (!id) return;
    this.supplyService.deleteMedia(id, mediaId).subscribe(() => {
      this.existingMedia.update(media => media.filter(m => m.id !== mediaId));
    });
  }

  setCover(mediaId: string): void {
    const id = this.supplyId();
    if (!id) return;
    this.supplyService.setCoverImage(id, mediaId).subscribe(() => {
      this.existingMedia.update(media => media.map(m => ({ ...m, isCover: m.id === mediaId })));
    });
  }

  onSubmit(): void {
    if (this.currentStep() !== 2) return;
    this.errorMsg.set(null);
    submit(this.supplyForm, async () => {
      this.saving.set(true);
      this.uploadProgress.set(0);
      try {
        const values = this.model();
        const discountType = values.discountType as DiscountType | '';
        let supplyId: string;

        if (this.isEditMode()) {
          const dto: UpdateSupplyDto = {
            name: values.name,
            description: values.description || undefined,
            price: Number(values.price),
            stockQuantity: Number(values.stockQuantity),
            discountType: discountType || undefined,
            discountValue: discountType && values.discountValue ? Number(values.discountValue) : undefined,
            discountLabel: discountType && values.discountLabel ? values.discountLabel : undefined,
            discountExpiresAt: discountType && values.discountExpiresAt ? new Date(values.discountExpiresAt).toISOString() : undefined,
          };
          await firstValueFrom(this.supplyService.updateSupply(this.supplyId()!, dto));
          supplyId = this.supplyId()!;
        } else {
          const dto: CreateSupplyDto = {
            name: values.name,
            price: Number(values.price),
            description: values.description || undefined,
            stockQuantity: Number(values.stockQuantity),
            discountType: discountType || undefined,
            discountValue: discountType && values.discountValue ? Number(values.discountValue) : undefined,
            discountLabel: discountType && values.discountLabel ? values.discountLabel : undefined,
            discountExpiresAt: discountType && values.discountExpiresAt ? new Date(values.discountExpiresAt).toISOString() : undefined,
          };
          const supply = await firstValueFrom(this.supplyService.createSupply(dto));
          supplyId = supply.id;
        }

        await this.uploadFiles(supplyId);
        this.router.navigate(['/seller/supplies']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        this.errorMsg.set(
          status === 403
            ? 'No tienes permisos para realizar esta acción.'
            : 'Ocurrió un error al guardar. Intenta de nuevo.',
        );
      } finally {
        this.saving.set(false);
      }
    });
  }

  private loadForEdit(id: string): void {
    this.loading.set(true);
    this.supplyService.getSupply(id).subscribe({
      next: (supply) => {
        const expiresAt = supply.discountExpiresAt
          ? new Date(supply.discountExpiresAt).toISOString().slice(0, 16)
          : '';
        this.model.set({
          name: supply.name,
          description: supply.description ?? '',
          price: supply.price,
          stockQuantity: supply.stockQuantity,
          discountType: supply.discountType ?? '',
          discountValue: supply.discountValue ?? 0,
          discountLabel: supply.discountLabel ?? '',
          discountExpiresAt: expiresAt,
        });
        this.existingMedia.set(supply.media ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el insumo. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  private addImageFiles(files: File[]): void {
    const valid = files
      .filter(f => IMAGE_MIME_TYPES.includes(f.type as MimeType))
      .map<PendingFile>(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        mediaType: 'image',
        mimeType: f.type as MimeType,
      }));
    this.pendingImages.update(curr => [...curr, ...valid]);
  }

  private async uploadFiles(supplyId: string): Promise<void> {
    const files = this.pendingImages();
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const pending = files[i];
      const { uploadUrl, s3Key } = await firstValueFrom(
        this.supplyService.requestPresignedUrl(supplyId, {
          mediaType: pending.mediaType,
          mimeType: pending.mimeType,
        }),
      );
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: pending.file,
        headers: { 'Content-Type': pending.mimeType },
      });
      if (!response.ok) throw new Error(`No se pudo subir ${pending.file.name}`);
      await firstValueFrom(
        this.supplyService.confirmMediaUpload(supplyId, {
          s3Key,
          mediaType: pending.mediaType,
          mimeType: pending.mimeType,
          sortOrder: i + 1,
          isCover: i === 0 && this.existingImages().length === 0,
        }),
      );
      this.uploadProgress.set(Math.round(((i + 1) / files.length) * 100));
    }
  }
}
