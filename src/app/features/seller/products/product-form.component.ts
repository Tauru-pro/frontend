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
import { form, FormField, submit, required, minLength, validate } from '@angular/forms/signals';
import { ProductService } from '../../../core/services/product.service';
import { BullService } from '../../../core/services/bull.service';
import { BreedService } from '../../../core/services/breed.service';
import {
  CreateProductDto,
  ProductMedia,
  ProductType,
  StrawType,
  STRAW_TYPES,
  STRAW_LABELS,
} from '../../../core/models/product.model';
import { BullOrigin, CreateBullDto, UpdateBullDto } from '../../../core/models/bull.model';
import { MimeType } from '../../../core/models/upload.model';
import {
  SearchSelectComponent,
  SelectOption,
} from '../../../shared/components/search-select/search-select.component';

interface BullModel {
  name: string;
  breedId: string;
  origin: BullOrigin | '';
  code: string;
  shortCode: string;
  description: string;
}

interface SupplyModel {
  name: string;
  description: string;
  price: number;
}

/** Fila de configuración comercial por tipo de pajilla. Sin archivos: los recursos son del toro. */
interface StrawRow {
  strawType: StrawType;
  enabled: boolean;
  price: number;
  minOrderQuantity: number;
  productId?: string;
}

interface PendingFile {
  file: File;
  preview: string;
  mediaType: 'image' | 'video' | 'document';
  mimeType: MimeType;
}

const IMAGE_MIME_TYPES: MimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_MIME_TYPES: MimeType[] = ['video/mp4', 'video/webm'];
const PDF_MIME_TYPES: MimeType[] = ['application/pdf'];

@Component({
  selector: 'app-product-form',
  imports: [RouterLink, FormField, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/products"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar producto' : 'Nuevo producto' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{
              isEditMode()
                ? 'Modifica los datos del producto'
                : 'Completa los datos para registrar tu producto'
            }}
          </p>
        </div>
      </div>

      <!-- Step indicator (navegable solo en modo edición) -->
      <div class="flex items-center px-1">
        <button
          type="button"
          [disabled]="!isEditMode()"
          (click)="goToStep(1)"
          class="flex items-center gap-2 rounded-lg transition-all"
          [class]="isEditMode() ? 'cursor-pointer hover:opacity-80' : 'cursor-default'"
        >
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >
            @if (currentStep() > 1) {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            } @else {
              1
            }
          </div>
          <span
            class="text-sm font-medium"
            [class]="currentStep() >= 1 ? 'text-gray-800' : 'text-gray-400'"
          >
            Información
          </span>
        </button>
        <div
          class="flex-1 mx-3 h-px transition-all"
          [class]="currentStep() > 1 ? 'bg-primary' : 'bg-gray-200'"
        ></div>
        <button
          type="button"
          [disabled]="!isEditMode()"
          (click)="goToStep(2)"
          class="flex items-center gap-2 rounded-lg transition-all"
          [class]="isEditMode() ? 'cursor-pointer hover:opacity-80' : 'cursor-default'"
        >
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >
            2
          </div>
          <span
            class="text-sm font-medium"
            [class]="currentStep() >= 2 ? 'text-gray-800' : 'text-gray-400'"
          >
            {{ isStraw() ? 'Archivos del toro' : 'Imágenes' }}
          </span>
        </button>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {
        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ errorMsg() }}
          </div>
        }

        @if (reviewNotes().length > 0) {
          <div class="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3.5 space-y-2">
            <div class="flex items-center gap-2">
              <svg
                class="w-4 h-4 text-orange-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p class="text-sm font-semibold text-orange-800">
                El revisor dejó observaciones para ajustar
              </p>
            </div>
            <ul class="space-y-1 pl-6">
              @for (n of reviewNotes(); track $index) {
                <li class="text-sm text-orange-700 leading-snug">
                  @if (n.label) {
                    <span class="font-semibold">{{ n.label }}:</span>
                  }
                  {{ n.note }}
                </li>
              }
            </ul>
            <p class="text-xs text-orange-600 pl-6">
              Ajusta lo indicado, guarda los cambios y vuelve a enviarlo a revisión desde «Mis
              Productos».
            </p>
          </div>
        }

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">
          @if (currentStep() === 1) {
            <!-- Tipo de producto -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                Tipo de producto
              </h2>

              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  [disabled]="isEditMode()"
                  (click)="setProductType('STRAW')"
                  [class]="
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ' +
                    (productType() === 'STRAW'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300') +
                    (isEditMode() ? ' opacity-50 cursor-not-allowed' : '')
                  "
                >
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  <span class="text-sm font-medium">Pajilla</span>
                  <span class="text-xs text-gray-400 text-center">Semen de un toro registrado</span>
                </button>
                <button
                  type="button"
                  [disabled]="isEditMode()"
                  (click)="setProductType('SUPPLIES')"
                  [class]="
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ' +
                    (productType() === 'SUPPLIES'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300') +
                    (isEditMode() ? ' opacity-50 cursor-not-allowed' : '')
                  "
                >
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <span class="text-sm font-medium">Insumo</span>
                  <span class="text-xs text-gray-400 text-center">Equipos y materiales</span>
                </button>
              </div>
              @if (showTypeError()) {
                <p class="text-red-400 text-xs">Selecciona el tipo de producto</p>
              }
            </div>

            @if (isStraw()) {
              <!-- Datos del toro -->
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                  Datos del toro
                </h2>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Nombre del toro <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    [formField]="bullForm.name"
                    placeholder="Ej. Marqués de Brahman"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (bullForm.name().touched() && bullForm.name().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5">
                      {{ bullForm.name().errors()[0].message }}
                    </p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Código <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    [formField]="bullForm.shortCode"
                    placeholder="Ej. 117/2"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (bullForm.shortCode().touched() && bullForm.shortCode().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5">
                      {{ bullForm.shortCode().errors()[0].message }}
                    </p>
                  }
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5"
                      >Número de registro</label
                    >
                    <input
                      type="text"
                      [formField]="bullForm.code"
                      placeholder="Ej. BRH-2023-001"
                      class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                    />
                  </div>
                  <app-search-select
                    label="Raza"
                    [required]="true"
                    placeholder="Buscar raza"
                    errorMessage="La raza es requerida"
                    [options]="breedsOptions()"
                    [value]="selectedBreedId()"
                    [loading]="breedLoading()"
                    [showError]="showSelectErrors()"
                    (valueChange)="onBreedSelected($event)"
                  />
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">
                      Origen <span class="text-red-400">*</span>
                    </label>
                    <select
                      [formField]="bullForm.origin"
                      class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
                    >
                      <option value="">Selecciona origen</option>
                      <option value="NATIONAL">Nacional</option>
                      <option value="IMPORTED">Importado</option>
                    </select>
                    @if (bullForm.origin().touched() && bullForm.origin().errors().length) {
                      <p class="text-red-400 text-xs mt-1.5">
                        {{ bullForm.origin().errors()[0].message }}
                      </p>
                    }
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                  <textarea
                    [formField]="bullForm.description"
                    rows="3"
                    placeholder="Describe las características genéticas del toro..."
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                  ></textarea>
                </div>
              </div>

              <!-- Precios por tipo de pajilla -->
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                    Precios por tipo de pajilla
                  </h2>
                  <p class="text-xs text-gray-400 mt-0.5">
                    Activa los tipos que ofreces y define su precio. El stock se gestiona en
                    Inventario.
                  </p>
                </div>

                @for (row of strawRows(); track row.strawType) {
                  <div
                    class="border rounded-xl p-4 transition-all"
                    [class]="row.enabled ? 'border-primary/40 bg-primary/5' : 'border-gray-200'"
                  >
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        [checked]="row.enabled"
                        (change)="toggleStraw(row.strawType, $any($event.target).checked)"
                        class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                      />
                      <span class="text-sm font-medium text-gray-800">{{
                        strawLabels[row.strawType]
                      }}</span>
                    </label>

                    @if (row.enabled) {
                      <div class="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1.5">
                            Precio (COP) <span class="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            [value]="row.price"
                            (input)="setStrawPrice(row.strawType, $any($event.target).value)"
                            placeholder="0"
                            class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1.5"
                            >Cantidad mínima</label
                          >
                          <input
                            type="number"
                            [value]="row.minOrderQuantity"
                            (input)="setStrawMin(row.strawType, $any($event.target).value)"
                            placeholder="1"
                            class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                    }
                  </div>
                }
                @if (strawError()) {
                  <p class="text-red-400 text-xs">{{ strawError() }}</p>
                }
              </div>
            }

            @if (isSupply()) {
              <!-- Información del insumo -->
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                  Información del producto
                </h2>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Nombre <span class="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    [formField]="supplyForm.name"
                    placeholder="Ej. Termo de nitrógeno"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (supplyForm.name().touched() && supplyForm.name().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5">
                      {{ supplyForm.name().errors()[0].message }}
                    </p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
                  <textarea
                    [formField]="supplyForm.description"
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
                    [formField]="supplyForm.price"
                    placeholder="0"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  @if (supplyForm.price().touched() && supplyForm.price().errors().length) {
                    <p class="text-red-400 text-xs mt-1.5">
                      {{ supplyForm.price().errors()[0].message }}
                    </p>
                  }
                </div>
              </div>
            }

            <div class="flex gap-3 justify-between pb-6">
              <a
                routerLink="/seller/products"
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </a>
              <button
                type="button"
                [disabled]="savingStep1()"
                (click)="goToStep2()"
                class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60"
              >
                @if (savingStep1()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                  Guardando...
                } @else {
                  Siguiente
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                }
              </button>
            </div>
          }

          @if (currentStep() === 2) {
            <!-- Imágenes -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                    Imágenes
                  </h2>
                  <p class="text-xs text-gray-400 mt-0.5">
                    JPG, PNG, WEBP o AVIF · Máximo 3 imágenes
                  </p>
                </div>
                @if (totalImages() > 0) {
                  <span class="text-xs text-gray-400">{{ totalImages() }} imagen(es)</span>
                }
              </div>

              @if (existingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (media of existingImages(); track media.id) {
                    <div class="relative aspect-square group">
                      <img
                        [src]="getMediaUrl(media.storagePath)"
                        class="w-full h-full object-cover rounded-xl"
                        alt="Imagen"
                      />
                      @if (media.isCover) {
                        <span
                          class="absolute top-1 left-1 bg-primary text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          >Portada</span
                        >
                      }
                      <div
                        class="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        @if (!media.isCover) {
                          <button
                            type="button"
                            (click)="setCover(media.id)"
                            title="Portada"
                            class="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                          >
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                              />
                            </svg>
                          </button>
                        }
                        <button
                          type="button"
                          (click)="deleteExistingMedia(media.id)"
                          title="Eliminar"
                          class="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <svg
                            class="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
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
                      <img
                        [src]="img.preview"
                        class="w-full h-full object-cover rounded-xl"
                        alt="Vista previa"
                      />
                      @if (i === 0 && existingImages().length === 0) {
                        <span
                          class="absolute top-1 left-1 bg-primary/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          >Portada</span
                        >
                      }
                      <button
                        type="button"
                        (click)="removeImage(i)"
                        class="absolute top-1 right-1 w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
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
                  <svg
                    class="w-8 h-8 mx-auto text-gray-300 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p class="text-sm text-gray-500">
                    <span class="font-medium text-primary">Haz clic para subir</span> o arrastra tus
                    imágenes aquí
                  </p>
                  <p class="text-xs text-gray-400 mt-1">
                    {{ 3 - totalImages() }} imagen(es) restante(s)
                  </p>
                </div>
                <input
                  #imageInput
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  class="hidden"
                  (change)="onImagesSelected($event)"
                />
              }
            </div>

            @if (isStraw()) {
              <!-- Video -->
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                    Video
                  </h2>
                  <p class="text-xs text-gray-400 mt-0.5">MP4 o WebM · Máximo 1 video</p>
                </div>

                @if (existingVideo()) {
                  <div class="relative rounded-xl overflow-hidden bg-gray-900">
                    <video
                      [src]="getMediaUrl(existingVideo()!.storagePath)"
                      class="w-full max-h-52 object-contain"
                      controls
                    ></video>
                    <button
                      type="button"
                      (click)="deleteExistingMedia(existingVideo()!.id)"
                      class="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                    >
                      <svg
                        class="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                }

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
                      <svg
                        class="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    <span class="absolute bottom-2 left-2 text-xs text-white/70">{{
                      pendingVideo()!.file.name
                    }}</span>
                  </div>
                }

                @if (!pendingVideo() && !existingVideo()) {
                  <div
                    class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    (dragover)="$event.preventDefault()"
                    (drop)="onVideoDrop($event)"
                    (click)="openVideoPicker()"
                  >
                    <svg
                      class="w-8 h-8 mx-auto text-gray-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M15 10l4.553-2.069A1 1 0 0121 8.88v6.24a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p class="text-sm text-gray-500">
                      <span class="font-medium text-primary">Haz clic para subir</span> o arrastra
                      el video aquí
                    </p>
                    <p class="text-xs text-gray-400 mt-1">MP4 o WebM</p>
                  </div>
                  <input
                    #videoInput
                    type="file"
                    accept="video/mp4,video/webm"
                    class="hidden"
                    (change)="onVideoSelected($event)"
                  />
                }
              </div>

              <!-- Prueba Genética (PDF) -->
              <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                    Prueba Genética
                  </h2>
                  <p class="text-xs text-gray-400 mt-0.5">PDF · Máximo 1 documento</p>
                </div>

                @if (existingDocuments().length > 0) {
                  @for (doc of existingDocuments(); track doc.id) {
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <svg
                        class="w-8 h-8 text-red-400 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3v-1h5v1H8z"
                        />
                      </svg>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">
                          {{ doc.storagePath.split('/').pop() ?? 'Prueba genética.pdf' }}
                        </p>
                        <a
                          [href]="getMediaUrl(doc.storagePath)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs text-primary hover:underline"
                          >Abrir documento</a
                        >
                      </div>
                      <button
                        type="button"
                        (click)="deleteExistingMedia(doc.id)"
                        class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  }
                }

                @if (pendingDocument()) {
                  <div
                    class="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl"
                  >
                    <svg
                      class="w-8 h-8 text-red-400 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3v-1h5v1H8z"
                      />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-800 truncate">
                        {{ pendingDocument()!.file.name }}
                      </p>
                      <p class="text-xs text-gray-400">Listo para subir</p>
                    </div>
                    <button
                      type="button"
                      (click)="removeDocument()"
                      class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                }

                @if (!pendingDocument() && existingDocuments().length === 0) {
                  <div
                    class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    (dragover)="$event.preventDefault()"
                    (drop)="onPdfDrop($event)"
                    (click)="openPdfPicker()"
                  >
                    <svg
                      class="w-8 h-8 mx-auto text-gray-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p class="text-sm text-gray-500">
                      <span class="font-medium text-primary">Haz clic para subir</span> o arrastra
                      tu PDF aquí
                    </p>
                    <p class="text-xs text-gray-400 mt-1">Solo PDF</p>
                  </div>
                  <input
                    #pdfInput
                    type="file"
                    accept="application/pdf"
                    class="hidden"
                    (change)="onPdfSelected($event)"
                  />
                }
              </div>
            }

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

            <div class="flex gap-3 justify-between pb-6">
              <button
                type="button"
                (click)="currentStep.set(1)"
                class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Atrás
              </button>
              <button
                type="submit"
                [disabled]="saving()"
                class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60"
              >
                @if (saving()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                  {{ uploadProgress() > 0 ? 'Subiendo archivos...' : 'Guardando...' }}
                } @else {
                  {{ isEditMode() ? 'Guardar cambios' : 'Finalizar' }}
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
  private breedService = inject(BreedService);

  protected readonly strawLabels = STRAW_LABELS;

  productType = signal<ProductType | ''>('');
  currentStep = signal(1);
  isEditMode = signal(false);
  productId = signal<string | null>(null);
  bullId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  savingStep1 = signal(false);
  errorMsg = signal<string | null>(null);
  uploadProgress = signal(0);
  showTypeError = signal(false);
  showSelectErrors = signal(false);
  strawError = signal<string | null>(null);

  pendingImages = signal<PendingFile[]>([]);
  pendingVideo = signal<PendingFile | null>(null);
  pendingDocument = signal<PendingFile | null>(null);
  existingMedia = signal<ProductMedia[]>([]);

  breedsOptions = signal<SelectOption[]>([]);
  selectedBreedId = signal<string | null>(null);
  breedLoading = signal(false);

  strawRows = signal<StrawRow[]>(
    STRAW_TYPES.map((t) => ({ strawType: t, enabled: false, price: 0, minOrderQuantity: 1 })),
  );

  /** Motivos de rechazo / cambios dejados por el revisor (modo edición). */
  reviewNotes = signal<{ label: string; note: string }[]>([]);

  imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageInput');
  videoInputRef = viewChild<ElementRef<HTMLInputElement>>('videoInput');
  pdfInputRef = viewChild<ElementRef<HTMLInputElement>>('pdfInput');

  isStraw = computed(() => this.productType() === 'STRAW');
  isSupply = computed(() => this.productType() === 'SUPPLIES');

  existingImages = computed(() => this.existingMedia().filter((m) => m.mediaType === 'image'));
  existingVideo = computed(() => this.existingMedia().find((m) => m.mediaType === 'video') ?? null);
  existingDocuments = computed(() =>
    this.existingMedia().filter((m) => m.mediaType === 'document'),
  );
  totalImages = computed(() => this.existingImages().length + this.pendingImages().length);

  bullModel = signal<BullModel>({ name: '', breedId: '', origin: '', code: '', shortCode: '', description: '' });
  supplyModel = signal<SupplyModel>({ name: '', description: '', price: 0 });

  bullForm = form(this.bullModel, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    minLength(s.name, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
    required(s.shortCode, { message: 'El código es requerido' });
    required(s.breedId, { message: 'La raza es requerida' });
    validate(s.origin, ({ value }) =>
      !(value() as string) ? { kind: 'required', message: 'El origen es requerido' } : undefined,
    );
  });

  supplyForm = form(this.supplyModel, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    validate(s.price, ({ value }) =>
      (value() as number) <= 0
        ? { kind: 'required', message: 'El precio es requerido' }
        : undefined,
    );
  });

  ngOnInit(): void {
    this.loadBreeds();
    const bullId = this.route.snapshot.paramMap.get('bullId');
    const id = this.route.snapshot.paramMap.get('id');
    if (bullId) {
      this.isEditMode.set(true);
      this.productType.set('STRAW');
      this.bullId.set(bullId);
      this.loadStrawGroupForEdit(bullId);
    } else if (id) {
      this.isEditMode.set(true);
      this.productType.set('SUPPLIES');
      this.productId.set(id);
      this.loadSupplyForEdit(id);
    }
  }

  ngOnDestroy(): void {
    this.pendingImages().forEach((f) => URL.revokeObjectURL(f.preview));
    const video = this.pendingVideo();
    if (video) URL.revokeObjectURL(video.preview);
    const doc = this.pendingDocument();
    if (doc) URL.revokeObjectURL(doc.preview);
  }

  setProductType(type: ProductType): void {
    if (this.isEditMode()) return;
    this.productType.set(type);
    this.showTypeError.set(false);
  }

  onBreedSelected(id: string | null): void {
    this.selectedBreedId.set(id);
    this.bullModel.update((m) => ({ ...m, breedId: id ?? '' }));
  }

  toggleStraw(type: StrawType, enabled: boolean): void {
    this.strawRows.update((rows) =>
      rows.map((r) => (r.strawType === type ? { ...r, enabled } : r)),
    );
    this.strawError.set(null);
  }

  setStrawPrice(type: StrawType, value: string): void {
    const price = Number(value);
    this.strawRows.update((rows) => rows.map((r) => (r.strawType === type ? { ...r, price } : r)));
  }

  setStrawMin(type: StrawType, value: string): void {
    const minOrderQuantity = Number(value);
    this.strawRows.update((rows) =>
      rows.map((r) => (r.strawType === type ? { ...r, minOrderQuantity } : r)),
    );
  }

  getMediaUrl(storagePath: string): string {
    return this.productService.getMediaPublicUrl(storagePath);
  }

  /** Navegación libre entre pasos, habilitada solo en modo edición. */
  goToStep(step: number): void {
    if (!this.isEditMode() || step === this.currentStep()) return;
    if (step === 2) {
      // Avanzar persiste los cambios del paso 1 (misma lógica que "Siguiente").
      this.goToStep2();
    } else {
      this.currentStep.set(step);
    }
  }

  async goToStep2(): Promise<void> {
    this.errorMsg.set(null);
    if (!this.productType()) {
      this.showTypeError.set(true);
      return;
    }
    if (this.isStraw()) {
      this.showSelectErrors.set(true);
      submit(this.bullForm, async () => {
        if (!this.validateStraws()) return;
        this.savingStep1.set(true);
        try {
          const b = this.bullModel();
          const dto: CreateBullDto | UpdateBullDto = {
            name: b.name,
            breedId: this.selectedBreedId()!,
            origin: b.origin as BullOrigin,
            code: b.code || undefined,
            shortCode: b.shortCode || undefined,
            description: b.description || undefined,
          };
          let bullId = this.bullId();
          if (this.isEditMode() && bullId) {
            await this.bullService.updateBull(bullId, dto);
          } else if (!bullId) {
            const created = await this.bullService.createBull(dto as CreateBullDto);
            bullId = created.id;
            this.bullId.set(bullId);
            this.isEditMode.set(true);
          }
          await this.syncStrawProducts(bullId!, b.name, b.description);
          this.currentStep.set(2);
        } catch (e) {
          this.errorMsg.set(this.mapSaveError(e));
        } finally {
          this.savingStep1.set(false);
        }
      });
    } else {
      submit(this.supplyForm, async () => {
        this.savingStep1.set(true);
        try {
          const v = this.supplyModel();
          if (this.isEditMode() && this.productId()) {
            await this.productService.updateProduct(this.productId()!, {
              name: v.name,
              description: v.description || undefined,
              price: Number(v.price),
            });
          } else if (!this.productId()) {
            const p = await this.productService.createProduct({
              productType: 'SUPPLIES',
              name: v.name,
              description: v.description || undefined,
              price: Number(v.price),
            });
            this.productId.set(p.id);
            this.isEditMode.set(true);
          }
          this.currentStep.set(2);
        } catch {
          this.errorMsg.set('No se pudo guardar la información. Intenta de nuevo.');
        } finally {
          this.savingStep1.set(false);
        }
      });
    }
  }

  private validateStraws(): boolean {
    const active = this.strawRows().filter((r) => r.enabled);
    if (active.length === 0) {
      this.strawError.set('Activa al menos un tipo de pajilla.');
      return false;
    }
    if (active.some((r) => Number(r.price) <= 0)) {
      this.strawError.set('Cada tipo activo requiere un precio mayor a 0.');
      return false;
    }
    this.strawError.set(null);
    return true;
  }

  private async syncStrawProducts(
    bullId: string,
    bullName: string,
    bullDescription: string,
  ): Promise<void> {
    const description = bullDescription || undefined;
    const updated: StrawRow[] = [];
    for (const row of this.strawRows()) {
      const name = `${bullName} - ${STRAW_LABELS[row.strawType]}`;
      if (row.enabled) {
        if (row.productId) {
          await this.productService.updateProduct(row.productId, {
            name,
            description,
            price: Number(row.price),
            minOrderQuantity: Number(row.minOrderQuantity),
            strawType: row.strawType,
          });
          updated.push(row);
        } else {
          const created = await this.productService.createProduct({
            productType: 'STRAW',
            name,
            description,
            price: Number(row.price),
            minOrderQuantity: Number(row.minOrderQuantity),
            bullId,
            strawType: row.strawType,
          });
          updated.push({ ...row, productId: created.id });
        }
      } else {
        if (row.productId) await this.productService.deleteProduct(row.productId);
        updated.push({ ...row, productId: undefined });
      }
    }
    this.strawRows.set(updated);
  }

  private mapSaveError(e: unknown): string {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'DUPLICATE_SHORT_CODE') return 'El código del toro ya existe. Usa otro.';
    if (msg === 'DUPLICATE_CODE') return 'El número de registro ya existe. Usa otro.';
    return 'No se pudo guardar la información. Intenta de nuevo.';
  }

  openImagePicker(): void {
    this.imageInputRef()?.nativeElement.click();
  }

  openVideoPicker(): void {
    this.videoInputRef()?.nativeElement.click();
  }

  openPdfPicker(): void {
    this.pdfInputRef()?.nativeElement.click();
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

  onPdfSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.addDocumentFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  onImageDrop(event: DragEvent): void {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
      IMAGE_MIME_TYPES.includes(f.type as MimeType),
    );
    this.addImageFiles(files);
  }

  onVideoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = Array.from(event.dataTransfer?.files ?? []).find((f) =>
      VIDEO_MIME_TYPES.includes(f.type as MimeType),
    );
    if (file) this.addVideoFile(file);
  }

  onPdfDrop(event: DragEvent): void {
    event.preventDefault();
    const file = Array.from(event.dataTransfer?.files ?? []).find((f) =>
      PDF_MIME_TYPES.includes(f.type as MimeType),
    );
    if (file) this.addDocumentFile(file);
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

  removeDocument(): void {
    const doc = this.pendingDocument();
    if (doc) URL.revokeObjectURL(doc.preview);
    this.pendingDocument.set(null);
  }

  async deleteExistingMedia(mediaId: string): Promise<void> {
    try {
      await this.mediaService().deleteMedia(mediaId);
      this.existingMedia.update((media) => media.filter((m) => m.id !== mediaId));
    } catch {
      this.errorMsg.set('No se pudo eliminar el archivo. Intenta de nuevo.');
    }
  }

  async setCover(mediaId: string): Promise<void> {
    const entityId = this.mediaEntityId();
    if (!entityId) return;
    try {
      await this.mediaService().setCoverImage(entityId, mediaId);
      this.existingMedia.update((media) => media.map((m) => ({ ...m, isCover: m.id === mediaId })));
    } catch {
      this.errorMsg.set('No se pudo establecer la portada. Intenta de nuevo.');
    }
  }

  onSubmit(): void {
    if (this.currentStep() !== 2) return;
    this.errorMsg.set(null);
    this.saving.set(true);
    this.uploadProgress.set(0);
    const entityId = this.mediaEntityId();
    if (!entityId) {
      this.errorMsg.set('Ocurrió un error inesperado. Vuelve al paso 1.');
      this.saving.set(false);
      return;
    }
    this.uploadFiles(entityId)
      .then(() => this.router.navigate(['/seller/products']))
      .catch(() => this.errorMsg.set('Ocurrió un error al subir los archivos. Intenta de nuevo.'))
      .finally(() => this.saving.set(false));
  }

  private mediaService(): BullService | ProductService {
    return this.isStraw() ? this.bullService : this.productService;
  }

  private mediaEntityId(): string | null {
    return this.isStraw() ? this.bullId() : this.productId();
  }

  private loadBreeds(): void {
    this.breedLoading.set(true);
    this.breedService.getAll().subscribe({
      next: (breeds) => {
        this.breedsOptions.set(breeds.map((s) => ({ id: s.id, label: s.name })));
        this.breedLoading.set(false);
      },
      error: () => this.breedLoading.set(false),
    });
  }

  private loadStrawGroupForEdit(bullId: string): void {
    this.loading.set(true);
    this.bullService.getBull(bullId).subscribe({
      next: (bull) => {
        this.bullModel.set({
          name: bull.name,
          breedId: bull.breedId,
          origin: bull.origin,
          code: bull.code ?? '',
          shortCode: bull.shortCode ?? '',
          description: bull.description ?? '',
        });
        this.selectedBreedId.set(bull.breedId);
        this.existingMedia.set(bull.media ?? []);
        this.productService.getStrawProductsByBull(bullId).subscribe({
          next: (straws) => {
            this.strawRows.set(
              STRAW_TYPES.map((t) => {
                const match = straws.find((p) => p.strawType === t);
                return match
                  ? {
                      strawType: t,
                      enabled: true,
                      price: match.price,
                      minOrderQuantity: match.minOrderQuantity,
                      productId: match.id,
                    }
                  : { strawType: t, enabled: false, price: 0, minOrderQuantity: 1 };
              }),
            );
            this.reviewNotes.set(
              straws
                .filter(
                  (p) =>
                    p.validationNotes &&
                    (p.status === 'REJECTED' || p.status === 'CHANGES_REQUESTED'),
                )
                .map((p) => ({
                  label: STRAW_LABELS[p.strawType!] ?? '',
                  note: p.validationNotes!,
                })),
            );
            this.loading.set(false);
          },
          error: () => {
            this.errorMsg.set('No se pudieron cargar las pajillas del toro. Intenta de nuevo.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el toro. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  private loadSupplyForEdit(id: string): void {
    this.loading.set(true);
    this.productService.getProduct(id).subscribe({
      next: (product) => {
        this.supplyModel.set({
          name: product.name,
          description: product.description ?? '',
          price: product.price,
        });
        this.existingMedia.set((product.media ?? []).filter((m) => m.entityType === 'product'));
        this.reviewNotes.set(
          product.validationNotes &&
            (product.status === 'REJECTED' || product.status === 'CHANGES_REQUESTED')
            ? [{ label: '', note: product.validationNotes }]
            : [],
        );
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
      .filter((f) => IMAGE_MIME_TYPES.includes(f.type as MimeType))
      .slice(0, remaining)
      .map<PendingFile>((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        mediaType: 'image',
        mimeType: f.type as MimeType,
      }));
    this.pendingImages.update((curr) => [...curr, ...valid]);
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

  private addDocumentFile(file: File): void {
    if (!PDF_MIME_TYPES.includes(file.type as MimeType)) return;
    const current = this.pendingDocument();
    if (current) URL.revokeObjectURL(current.preview);
    this.pendingDocument.set({
      file,
      preview: URL.createObjectURL(file),
      mediaType: 'document',
      mimeType: file.type as MimeType,
    });
  }

  private async uploadFiles(entityId: string): Promise<void> {
    const allFiles: PendingFile[] = [
      ...this.pendingImages(),
      ...(this.isStraw() && this.pendingVideo() ? [this.pendingVideo()!] : []),
      ...(this.isStraw() && this.pendingDocument() ? [this.pendingDocument()!] : []),
    ];
    if (allFiles.length === 0) return;

    for (let i = 0; i < allFiles.length; i++) {
      const pending = allFiles[i];
      const isCover =
        i === 0 && pending.mediaType === 'image' && this.existingImages().length === 0;
      if (this.isStraw()) {
        await this.bullService.uploadBullMedia(entityId, pending.file, pending.mediaType, isCover);
      } else {
        await this.productService.uploadProductMedia(
          entityId,
          pending.file,
          pending.mediaType,
          isCover,
        );
      }
      this.uploadProgress.set(Math.round(((i + 1) / allFiles.length) * 100));
    }
  }
}
