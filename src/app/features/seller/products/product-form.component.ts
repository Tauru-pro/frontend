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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  required,
  validate,
} from '@angular/forms/signals';
import { ProductService } from '../../../core/services/product.service';
import { BullService } from '../../../core/services/bull.service';
import {
  CreateProductDto,
  ProductMedia,
  ProductType,
  StrawType,
  UpdateProductDto,
} from '../../../core/models/product.model';
import { MimeType } from '../../../core/models/upload.model';
import { SearchSelectComponent, SelectOption } from '../../../shared/components/search-select/search-select.component';

interface ProductFormModel {
  productType: ProductType | '';
  name: string;
  description: string;
  price: number;
  minOrderQuantity: number;
  bullId: string;
  strawType: StrawType | '';
}

interface PendingFile {
  file: File;
  preview: string;
  mimeType: MimeType;
}

const IMAGE_MIME_TYPES: MimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

@Component({
  selector: 'app-product-form',
  imports: [RouterLink, FormField, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a routerLink="/seller/products"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar producto' : 'Nuevo producto' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEditMode() ? 'Modifica los datos del producto' : 'Completa los datos para registrar tu producto' }}
          </p>
        </div>
      </div>

      <!-- Step indicator -->
      <div class="flex items-center px-1">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'">
            @if (currentStep() > 1) {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            } @else { 1 }
          </div>
          <span class="text-sm font-medium" [class]="currentStep() >= 1 ? 'text-gray-800' : 'text-gray-400'">
            Información
          </span>
        </div>
        @if (!isStraw()) {
          <div class="flex-1 mx-3 h-px transition-all" [class]="currentStep() > 1 ? 'bg-primary' : 'bg-gray-200'"></div>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
              [class]="currentStep() >= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'">2</div>
            <span class="text-sm font-medium" [class]="currentStep() >= 2 ? 'text-gray-800' : 'text-gray-400'">
              Imágenes
            </span>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ errorMsg() }}
          </div>
        }

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          @if (currentStep() === 1) {

            <!-- Tipo de producto -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Tipo de producto</h2>

              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  [disabled]="isEditMode()"
                  (click)="setProductType('STRAW')"
                  [class]="'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ' +
                    (model().productType === 'STRAW'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300') +
                    (isEditMode() ? ' opacity-50 cursor-not-allowed' : '')"
                >
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                  <span class="text-sm font-medium">Pajilla</span>
                  <span class="text-xs text-gray-400 text-center">Semen de un toro registrado</span>
                </button>
                <button
                  type="button"
                  [disabled]="isEditMode()"
                  (click)="setProductType('SUPPLIES')"
                  [class]="'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ' +
                    (model().productType === 'SUPPLIES'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300') +
                    (isEditMode() ? ' opacity-50 cursor-not-allowed' : '')"
                >
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                  </svg>
                  <span class="text-sm font-medium">Insumo</span>
                  <span class="text-xs text-gray-400 text-center">Equipos y materiales</span>
                </button>
              </div>
              @if (showTypeError()) {
                <p class="text-red-400 text-xs">Selecciona el tipo de producto</p>
              }
            </div>

            @if (model().productType === 'STRAW') {
              <!-- Campos STRAW -->
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Datos de la pajilla</h2>

                <app-search-select
                  label="Toro"
                  [required]="true"
                  placeholder="Selecciona un toro"
                  errorMessage="El toro es requerido"
                  [options]="bullOptions()"
                  [value]="model().bullId || null"
                  [loading]="bullsLoading()"
                  [showError]="showSelectErrors()"
                  (valueChange)="onBullSelected($event)"
                />

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Tipo de pajilla <span class="text-red-400">*</span>
                  </label>
                  <select
                    [formField]="productForm.strawType"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
                  >
                    <option value="">Selecciona tipo</option>
                    <option value="CONVENTIONAL">Convencional</option>
                    <option value="SEXADO_MALE">Sexado Macho</option>
                    <option value="SEXADO_FEMALE">Sexado Hembra</option>
                  </select>
                  @if (productForm.strawType().touched() && productForm.strawType().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5">{{ productForm.strawType().errors()[0].message }}</p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Cantidad mínima de pedido</label>
                  <input
                    type="number"
                    [formField]="productForm.minOrderQuantity"
                    placeholder="1"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                </div>
              </div>
            }

            <!-- Información común -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información del producto</h2>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre <span class="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  [formField]="productForm.name"
                  placeholder="Ej. Pajilla Brahman Elite"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (productForm.name().touched() && productForm.name().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5">{{ productForm.name().errors()[0].message }}</p>
                }
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                <textarea
                  [formField]="productForm.description"
                  rows="3"
                  placeholder="Describe el producto..."
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                ></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Precio (COP) <span class="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  [formField]="productForm.price"
                  placeholder="0"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (productForm.price().touched() && productForm.price().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5">{{ productForm.price().errors()[0].message }}</p>
                }
              </div>
            </div>

            <div class="flex gap-3 justify-end pb-6">
              <a routerLink="/seller/products"
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                Cancelar
              </a>
              <button type="button" [disabled]="savingStep1()" (click)="goToStep2()"
                class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60">
                @if (savingStep1()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Guardando...
                } @else {
                  {{ isStraw() ? 'Guardar' : 'Siguiente' }}
                  @if (!isStraw()) {
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  }
                }
              </button>
            </div>
          }

          @if (currentStep() === 2) {

            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Imágenes</h2>
                  <p class="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP o AVIF · Máximo 3 imágenes</p>
                </div>
                @if (totalImages() > 0) {
                  <span class="text-xs text-gray-400">{{ totalImages() }} imagen(es)</span>
                }
              </div>

              @if (existingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (media of existingImages(); track media.id) {
                    <div class="relative aspect-square group">
                      <img [src]="getMediaUrl(media.storagePath)" class="w-full h-full object-cover rounded-xl" alt="Imagen"/>
                      @if (media.isCover) {
                        <span class="absolute top-1 left-1 bg-primary text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">Portada</span>
                      }
                      <div class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        @if (!media.isCover) {
                          <button type="button" (click)="setCover(media.id)" title="Portada"
                            class="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                          </button>
                        }
                        <button type="button" (click)="deleteExistingMedia(media.id)" title="Eliminar"
                          class="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
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
                        <span class="absolute top-1 left-1 bg-primary/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">Portada</span>
                      }
                      <button type="button" (click)="removeImage(i)"
                        class="absolute top-1 right-1 w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              }

              @if (totalImages() < 3) {
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
                  <p class="text-xs text-gray-400 mt-1">{{ 3 - totalImages() }} imagen(es) restante(s)</p>
                </div>
                <input #imageInput type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple class="hidden" (change)="onImagesSelected($event)"/>
              }
            </div>

            @if (saving() && uploadProgress() > 0) {
              <div class="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-600 font-medium">Subiendo imágenes...</span>
                  <span class="text-primary font-semibold">{{ uploadProgress() }}%</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary rounded-full transition-all duration-300" [style.width.%]="uploadProgress()"></div>
                </div>
              </div>
            }

            <div class="flex gap-3 justify-between pb-6">
              <button type="button" (click)="currentStep.set(1)"
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Atrás
              </button>
              <button type="submit" [disabled]="saving()" class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60">
                @if (saving()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {{ uploadProgress() > 0 ? 'Subiendo imágenes...' : 'Guardando...' }}
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
  private bullService = inject(BullService);

  currentStep = signal(1);
  isEditMode = signal(false);
  productId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  savingStep1 = signal(false);
  errorMsg = signal<string | null>(null);
  uploadProgress = signal(0);
  showTypeError = signal(false);
  showSelectErrors = signal(false);

  pendingImages = signal<PendingFile[]>([]);
  existingMedia = signal<ProductMedia[]>([]);

  bullOptions = signal<SelectOption[]>([]);
  bullsLoading = signal(false);

  imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageInput');

  existingImages = computed(() => this.existingMedia().filter(m => m.mediaType === 'image'));
  totalImages = computed(() => this.existingImages().length + this.pendingImages().length);
  isStraw = computed(() => this.model().productType === 'STRAW');

  model = signal<ProductFormModel>({
    productType: '',
    name: '',
    description: '',
    price: 0,
    minOrderQuantity: 1,
    bullId: '',
    strawType: '',
  });

  productForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    validate(s.price, ({ value }) =>
      (value() as number) <= 0
        ? { kind: 'required', message: 'El precio es requerido' }
        : undefined,
    );
    validate(s.strawType, ({ value }) =>
      this.model().productType === 'STRAW' && !(value() as string)
        ? { kind: 'required', message: 'El tipo de pajilla es requerido' }
        : undefined,
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.loadBulls();
    if (id) {
      this.isEditMode.set(true);
      this.productId.set(id);
      this.loadForEdit(id);
    }
  }

  ngOnDestroy(): void {
    this.pendingImages().forEach(f => URL.revokeObjectURL(f.preview));
  }

  setProductType(type: ProductType): void {
    if (this.isEditMode()) return;
    this.model.update(m => ({ ...m, productType: type }));
    this.showTypeError.set(false);
  }

  onBullSelected(id: string | null): void {
    this.model.update(m => ({ ...m, bullId: id ?? '' }));
  }

  getMediaUrl(storagePath: string): string {
    return this.productService.getMediaPublicUrl(storagePath);
  }

  async goToStep2(): Promise<void> {
    if (!this.model().productType) {
      this.showTypeError.set(true);
      return;
    }
    if (this.model().productType === 'STRAW' && !this.model().bullId) {
      this.showSelectErrors.set(true);
      return;
    }
    this.errorMsg.set(null);
    submit(this.productForm, async () => {
      this.savingStep1.set(true);
      try {
        const values = this.model();
        if (this.isEditMode() && this.productId()) {
          const dto: UpdateProductDto = {
            name: values.name,
            description: values.description || undefined,
            price: Number(values.price),
            minOrderQuantity: Number(values.minOrderQuantity),
            bullId: values.bullId || undefined,
            strawType: (values.strawType as StrawType) || undefined,
          };
          await this.productService.updateProduct(this.productId()!, dto);
        } else if (!this.productId()) {
          const dto: CreateProductDto = {
            productType: values.productType as ProductType,
            name: values.name,
            description: values.description || undefined,
            price: Number(values.price),
            minOrderQuantity: Number(values.minOrderQuantity),
            bullId: values.bullId || undefined,
            strawType: (values.strawType as StrawType) || undefined,
          };
          const product = await this.productService.createProduct(dto);
          this.productId.set(product.id);
          this.isEditMode.set(true);
        }
        if (this.isStraw()) {
          this.router.navigate(['/seller/products']);
          return;
        }
        this.currentStep.set(2);
      } catch {
        this.errorMsg.set('No se pudo guardar la información. Intenta de nuevo.');
      } finally {
        this.savingStep1.set(false);
      }
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

  async deleteExistingMedia(mediaId: string): Promise<void> {
    try {
      await this.productService.deleteMedia(mediaId);
      this.existingMedia.update(media => media.filter(m => m.id !== mediaId));
    } catch {
      this.errorMsg.set('No se pudo eliminar la imagen. Intenta de nuevo.');
    }
  }

  async setCover(mediaId: string): Promise<void> {
    const id = this.productId();
    if (!id) return;
    try {
      await this.productService.setCoverImage(id, mediaId);
      this.existingMedia.update(media => media.map(m => ({ ...m, isCover: m.id === mediaId })));
    } catch {
      this.errorMsg.set('No se pudo establecer la portada. Intenta de nuevo.');
    }
  }

  onSubmit(): void {
    if (this.currentStep() !== 2) return;
    this.errorMsg.set(null);
    this.saving.set(true);
    this.uploadProgress.set(0);
    const id = this.productId();
    if (!id) {
      this.errorMsg.set('Ocurrió un error inesperado. Vuelve al paso 1.');
      this.saving.set(false);
      return;
    }
    this.uploadFiles(id)
      .then(() => this.router.navigate(['/seller/products']))
      .catch(() => this.errorMsg.set('Ocurrió un error al subir las imágenes. Intenta de nuevo.'))
      .finally(() => this.saving.set(false));
  }

  private loadBulls(): void {
    this.bullsLoading.set(true);
    this.bullService.getMyBullsForSelect().subscribe({
      next: (bulls) => {
        this.bullOptions.set(bulls.map(b => ({ id: b.id, label: b.name })));
        this.bullsLoading.set(false);
      },
      error: () => this.bullsLoading.set(false),
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
          minOrderQuantity: product.minOrderQuantity,
          bullId: product.bullId ?? '',
          strawType: product.strawType ?? '',
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
    const remaining = 3 - this.totalImages();
    const valid = files
      .filter(f => IMAGE_MIME_TYPES.includes(f.type as MimeType))
      .slice(0, remaining)
      .map<PendingFile>(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        mimeType: f.type as MimeType,
      }));
    this.pendingImages.update(curr => [...curr, ...valid]);
  }

  private async uploadFiles(productId: string): Promise<void> {
    const files = this.pendingImages();
    if (files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const pending = files[i];
      await this.productService.uploadProductMedia(
        productId,
        pending.file,
        'image',
        i === 0 && this.existingImages().length === 0,
      );
      this.uploadProgress.set(Math.round(((i + 1) / files.length) * 100));
    }
  }
}
