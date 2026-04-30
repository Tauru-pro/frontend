import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { ProductService } from '../../../core/services/product.service';
import {
  CreateProductDto,
  ProductMedia,
  ProductType,
  UpdateProductDto,
} from '../../../core/models/product.model';
import { MimeType } from '../../../core/models/upload.model';
import { environment } from '../../../../environments/environment';

interface ProductFormModel {
  productType: ProductType;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
}

interface PendingFile {
  file: File;
  preview: string;
  mediaType: 'image' | 'video';
  mimeType: MimeType;
}

const IMAGE_MIME_TYPES: MimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_MIME_TYPES: MimeType[] = ['video/mp4', 'video/webm'];

@Component({
  selector: 'app-product-form',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/products"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar producto' : 'Nuevo producto' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEditMode() ? 'Modifica los datos de tu producto' : 'Completa los datos para publicar tu producto' }}
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
            } @else {
              1
            }
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
          >
            2
          </div>
          <span class="text-sm font-medium" [class]="currentStep() >= 2 ? 'text-gray-800' : 'text-gray-400'">
            Archivos
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

          <!-- ===== STEP 1: Información básica ===== -->
          @if (currentStep() === 1) {

            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información básica</h2>


              <!-- Nombre -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre del producto <span class="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  [formField]="productForm.name"
                  placeholder="Ej. Pistola de transferencia de embriones"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (productForm.name().touched() && productForm.name().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ productForm.name().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Descripción -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                <textarea
                  [formField]="productForm.description"
                  rows="3"
                  placeholder="Describe las características del producto..."
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
                    [formField]="productForm.price"
                    placeholder="0"
                    step="0.01"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (productForm.price().touched() && productForm.price().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                      </svg>
                      {{ productForm.price().errors()[0].message }}
                    </p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Cantidad en stock <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    [formField]="productForm.stockQuantity"
                    placeholder="0"
                    step="1"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (productForm.stockQuantity().touched() && productForm.stockQuantity().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                      </svg>
                      {{ productForm.stockQuantity().errors()[0].message }}
                    </p>
                  }
                </div>
              </div>
            </div>

            <!-- Step 1 actions -->
            <div class="flex gap-3 justify-end pb-6">
              <a
                routerLink="/seller/products"
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

          <!-- ===== STEP 2: Archivos ===== -->
          @if (currentStep() === 2) {

            <!-- Imágenes -->
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

              <!-- Existing images (edit mode) -->
              @if (existingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (media of existingImages(); track media.id) {
                    <div class="relative aspect-square group">
                      <img
                        [src]="getMediaUrl(media.s3Key)"
                        class="w-full h-full object-cover rounded-xl"
                        alt="Imagen del producto"
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

              <!-- Pending image previews -->
              @if (pendingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (img of pendingImages(); track img.preview; let i = $index) {
                    <div class="relative aspect-square group">
                      <img
                        [src]="img.preview"
                        class="w-full h-full object-cover rounded-xl"
                        alt="Vista previa"
                      />
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

              <!-- Image drop zone -->
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

            <!-- Video (solo STRAW) -->
            @if (!isSupplies()) {
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Video</h2>
                  <p class="text-xs text-gray-400 mt-0.5">MP4 o WebM · Máximo 1 video</p>
                </div>

                <!-- Existing video (edit mode) -->
                @if (existingVideo()) {
                  <div class="relative rounded-xl overflow-hidden bg-gray-900">
                    <video
                      [src]="getMediaUrl(existingVideo()!.s3Key)"
                      class="w-full max-h-52 object-contain"
                      controls
                    ></video>
                    <button
                      type="button"
                      (click)="deleteExistingMedia(existingVideo()!.id)"
                      class="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                }

                <!-- Pending video preview -->
                @if (pendingVideo()) {
                  <div class="relative rounded-xl overflow-hidden bg-gray-900">
                    <video
                      [src]="pendingVideo()!.preview"
                      class="w-full max-h-52 object-contain"
                      controls
                    ></video>
                    <button
                      type="button"
                      (click)="removeVideo()"
                      class="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                    <span class="absolute bottom-2 left-2 text-xs text-white/70">{{ pendingVideo()!.file.name }}</span>
                  </div>
                }

                <!-- Video drop zone -->
                @if (!pendingVideo() && !existingVideo()) {
                  <div
                    class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    (dragover)="$event.preventDefault()"
                    (drop)="onVideoDrop($event)"
                    (click)="openVideoPicker()"
                  >
                    <svg class="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.069A1 1 0 0121 8.88v6.24a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    <p class="text-sm text-gray-500">
                      <span class="font-medium text-primary">Haz clic para subir</span> o arrastra el video aquí
                    </p>
                    <p class="text-xs text-gray-400 mt-1">MP4 o WebM</p>
                  </div>
                }

                <input
                  #videoInput
                  type="file"
                  accept="video/mp4,video/webm"
                  class="hidden"
                  (change)="onVideoSelected($event)"
                />
              </div>
            }

            <!-- Upload progress -->
            @if (saving() && uploadProgress() > 0) {
              <div class="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-600 font-medium">Subiendo archivos...</span>
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

            <!-- Generic error -->
            @if (errorMsg()) {
              <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {{ errorMsg() }}
              </div>
            }

            <!-- Step 2 actions -->
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
                  {{ uploadProgress() > 0 ? 'Subiendo archivos...' : 'Guardando...' }}
                } @else {
                  {{ isEditMode() ? 'Guardar cambios' : 'Crear producto' }}
                }
              </button>
            </div>
          }

        </form>
      }
    </div>
  `,
})
export default class ProductFormComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);

  currentStep = signal(1);
  isEditMode = signal(false);
  productId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);

  errorMsg = signal<string | null>(null);
  uploadProgress = signal(0);
  pendingImages = signal<PendingFile[]>([]);
  pendingVideo = signal<PendingFile | null>(null);
  existingMedia = signal<ProductMedia[]>([]);

  imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageInput');
  videoInputRef = viewChild<ElementRef<HTMLInputElement>>('videoInput');

  isSupplies = computed(() => this.model().productType === 'SUPPLIES');
  existingImages = computed(() => this.existingMedia().filter(m => m.mediaType === 'image'));
  existingVideo = computed(() => this.existingMedia().find(m => m.mediaType === 'video') ?? null);

  private readonly _clearVideoOnSupplies = effect(() => {
    if (this.isSupplies()) this.removeVideo();
  });

  model = signal<ProductFormModel>({
    productType: 'SUPPLIES',
    name: '',
    description: '',
    price: 0,
    stockQuantity: 0,
  });

  productForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    minLength(s.name, 3, { message: 'El nombre debe tener al menos 3 caracteres' });
    required(s.price, { message: 'El precio es requerido' });
    validate(s.price, ({ value }) =>
      (value() as number) <= 0
        ? { kind: 'min', message: 'El precio debe ser mayor a 0' }
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
      this.productId.set(id);
      this.loadForEdit(id);
    }
  }

  ngOnDestroy(): void {
    this.pendingImages().forEach(f => URL.revokeObjectURL(f.preview));
    const video = this.pendingVideo();
    if (video) URL.revokeObjectURL(video.preview);
  }

  getMediaUrl(key: string): string {
    return `${environment.cdn}/${key}`;
  }

  goToStep2(): void {
    submit(this.productForm, async () => {
      this.currentStep.set(2);
    });
  }

  openImagePicker(): void {
    this.imageInputRef()?.nativeElement.click();
  }

  openVideoPicker(): void {
    this.videoInputRef()?.nativeElement.click();
  }

  onImagesSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    this.addImageFiles(Array.from(files));
    (event.target as HTMLInputElement).value = '';
  }

  onVideoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.addVideoFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  onImageDrop(event: DragEvent): void {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f =>
      IMAGE_MIME_TYPES.includes(f.type as MimeType),
    );
    this.addImageFiles(files);
  }

  onVideoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = Array.from(event.dataTransfer?.files ?? []).find(f =>
      VIDEO_MIME_TYPES.includes(f.type as MimeType),
    );
    if (file) this.addVideoFile(file);
  }

  removeImage(index: number): void {
    const files = [...this.pendingImages()];
    URL.revokeObjectURL(files[index].preview);
    files.splice(index, 1);
    this.pendingImages.set(files);
  }

  removeVideo(): void {
    const video = this.pendingVideo();
    if (video) URL.revokeObjectURL(video.preview);
    this.pendingVideo.set(null);
  }

  deleteExistingMedia(mediaId: string): void {
    const id = this.productId();
    if (!id) return;
    this.productService.deleteMedia(id, mediaId).subscribe(() => {
      this.existingMedia.update(media => media.filter(m => m.id !== mediaId));
    });
  }

  setCover(mediaId: string): void {
    const id = this.productId();
    if (!id) return;
    this.productService.setCoverImage(id, mediaId).subscribe(() => {
      this.existingMedia.update(media => media.map(m => ({ ...m, isCover: m.id === mediaId })));
    });
  }

  onSubmit(): void {
    if (this.currentStep() !== 2) return;

    this.errorMsg.set(null);
    submit(this.productForm, async () => {
      this.saving.set(true);
      this.uploadProgress.set(0);
      try {
        const values = this.model();
        let productId: string;

        if (this.isEditMode()) {
          const dto: UpdateProductDto = {
            name: values.name,
            description: values.description || undefined,
            price: Number(values.price),
            stockQuantity: Number(values.stockQuantity),
          };
          await firstValueFrom(this.productService.updateProduct(this.productId()!, dto));
          productId = this.productId()!;
        } else {
          const dto: CreateProductDto = {
            productType: 'SUPPLIES',
            name: values.name,
            description: values.description || undefined,
            price: Number(values.price),
            stockQuantity: Number(values.stockQuantity),
          };
          const product = await firstValueFrom(this.productService.createProduct(dto));
          productId = product.id;
        }

        await this.uploadFiles(productId);
        this.router.navigate(['/seller/products']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        if (status === 403) {

          this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }

  private loadForEdit(id: string): void {
    this.loading.set(true);
    this.productService.getProduct(id).subscribe({
      next: (product) => {
        this.model.set({
          productType: product.productType,
          name: product.name,
          description: product.description ?? '',
          price: product.price,
          stockQuantity: product.stockQuantity,
        });
        this.existingMedia.set(product.media ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el producto. Intenta de nuevo.');
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

  private addVideoFile(file: File): void {
    if (!VIDEO_MIME_TYPES.includes(file.type as MimeType)) return;
    const current = this.pendingVideo();
    if (current) URL.revokeObjectURL(current.preview);
    this.pendingVideo.set({
      file,
      preview: URL.createObjectURL(file),
      mediaType: 'video',
      mimeType: file.type as MimeType,
    });
  }

  private async uploadFiles(productId: string): Promise<void> {
    const allFiles: PendingFile[] = [
      ...this.pendingImages(),
      ...(!this.isSupplies() && this.pendingVideo() ? [this.pendingVideo()!] : []),
    ];
    if (allFiles.length === 0) return;

    for (let i = 0; i < allFiles.length; i++) {
      const pending = allFiles[i];
      const { uploadUrl, s3Key } = await firstValueFrom(
        this.productService.requestPresignedUrl(productId, {
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
        this.productService.confirmMediaUpload(productId, {
          s3Key,
          mediaType: pending.mediaType,
          mimeType: pending.mimeType,
          sortOrder: i + 1,
          isCover: i === 0 && pending.mediaType === 'image' && this.existingImages().length === 0,
        }),
      );
      this.uploadProgress.set(Math.round(((i + 1) / allFiles.length) * 100));
    }
  }
}
