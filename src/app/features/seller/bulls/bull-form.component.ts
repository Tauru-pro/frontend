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
  minLength,
  validate,
} from '@angular/forms/signals';
import { BullService } from '../../../core/services/bull.service';
import {
  BullMedia,
  BullOrigin,
  BullRegistrationType,
  CreateBullDto,
  UpdateBullDto,
} from '../../../core/models/bull.model';
import { MimeType } from '../../../core/models/upload.model';
import { SearchSelectComponent, SelectOption } from '../../../shared/components/search-select/search-select.component';
import { BreedService } from '../../../core/services/breed.service';

interface BullFormModel {
  name: string;
  breedId: string;
  origin: BullOrigin | '';
  code: string;
  description: string;
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
  selector: 'app-bull-form',
  imports: [RouterLink, FormField, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/bulls"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar toro' : 'Nuevo toro' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEditMode() ? 'Modifica los datos del toro' : 'Completa los datos para registrar tu toro' }}
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
        <div class="flex-1 mx-3 h-px transition-all" [class]="currentStep() > 1 ? 'bg-primary' : 'bg-gray-200'"></div>
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >2</div>
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

        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ errorMsg() }}
          </div>
        }

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          @if (currentStep() === 1) {
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información básica</h2>

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
                  <p class="text-red-400 text-xs mt-1.5">{{ bullForm.name().errors()[0].message }}</p>
                }
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

            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información genética</h2>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Número de registro</label>
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
                    <p class="text-red-400 text-xs mt-1.5">{{ bullForm.origin().errors()[0].message }}</p>
                  }
                </div>
              </div>
            </div>

            <div class="flex gap-3 justify-end pb-6">
              <a
                routerLink="/seller/bulls"
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
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Guardando...
                } @else {
                  Siguiente
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
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
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Imágenes</h2>
                  <p class="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP o AVIF · Máximo 3 imágenes</p>
                </div>
                @if (existingImages().length + pendingImages().length > 0) {
                  <span class="text-xs text-gray-400">{{ existingImages().length + pendingImages().length }} imagen(es)</span>
                }
              </div>

              @if (existingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (media of existingImages(); track media.id) {
                    <div class="relative aspect-square group">
                      <img [src]="getMediaUrl(media.storagePath)" class="w-full h-full object-cover rounded-xl" alt="Imagen del toro"/>
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

            <!-- Video -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div>
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Video</h2>
                <p class="text-xs text-gray-400 mt-0.5">MP4 o WebM · Máximo 1 video</p>
              </div>

              @if (existingVideo()) {
                <div class="relative rounded-xl overflow-hidden bg-gray-900">
                  <video [src]="getMediaUrl(existingVideo()!.storagePath)" class="w-full max-h-52 object-contain" controls></video>
                  <button type="button" (click)="deleteExistingMedia(existingVideo()!.id)"
                    class="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              }

              @if (pendingVideo()) {
                <div class="relative rounded-xl overflow-hidden bg-gray-900">
                  <video [src]="pendingVideo()!.preview" class="w-full max-h-52 object-contain" controls></video>
                  <button type="button" (click)="removeVideo()"
                    class="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                  <span class="absolute bottom-2 left-2 text-xs text-white/70">{{ pendingVideo()!.file.name }}</span>
                </div>
              }

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
                <input #videoInput type="file" accept="video/mp4,video/webm" class="hidden" (change)="onVideoSelected($event)"/>
              }
            </div>

            <!-- Prueba Genética (PDF) -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div>
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Prueba Genética</h2>
                <p class="text-xs text-gray-400 mt-0.5">PDF · Máximo 1 documento</p>
              </div>

              @if (existingDocuments().length > 0) {
                @for (doc of existingDocuments(); track doc.id) {
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <svg class="w-8 h-8 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3v-1h5v1H8z"/>
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-800 truncate">{{ doc.storagePath.split('/').pop() ?? 'Prueba genética.pdf' }}</p>
                      <a [href]="getMediaUrl(doc.storagePath)" target="_blank" rel="noopener noreferrer"
                        class="text-xs text-primary hover:underline">Abrir documento</a>
                    </div>
                    <button type="button" (click)="deleteExistingMedia(doc.id)"
                      class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                }
              }

              @if (pendingDocument()) {
                <div class="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <svg class="w-8 h-8 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3v-1h5v1H8z"/>
                  </svg>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ pendingDocument()!.file.name }}</p>
                    <p class="text-xs text-gray-400">Listo para subir</p>
                  </div>
                  <button type="button" (click)="removeDocument()"
                    class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
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
                  <svg class="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <p class="text-sm text-gray-500">
                    <span class="font-medium text-primary">Haz clic para subir</span> o arrastra tu PDF aquí
                  </p>
                  <p class="text-xs text-gray-400 mt-1">Solo PDF</p>
                </div>
                <input #pdfInput type="file" accept="application/pdf" class="hidden" (change)="onPdfSelected($event)"/>
              }
            </div>

            @if (saving() && uploadProgress() > 0) {
              <div class="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-600 font-medium">Subiendo archivos...</span>
                  <span class="text-primary font-semibold">{{ uploadProgress() }}%</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary rounded-full transition-all duration-300" [style.width.%]="uploadProgress()"></div>
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
                  {{ uploadProgress() > 0 ? 'Subiendo archivos...' : 'Guardando...' }}
                } @else {
                  {{ isEditMode() ? 'Guardar cambios' : 'Crear toro' }}
                }
              </button>
            </div>
          }

        </form>
      }
    </div>
  `,
})
export default class BullFormComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bullService = inject(BullService);
  private breedService = inject(BreedService);

  currentStep = signal(1);
  isEditMode = signal(false);
  bullId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  savingStep1 = signal(false);
  errorMsg = signal<string | null>(null);
  uploadProgress = signal(0);

  pendingImages = signal<PendingFile[]>([]);
  pendingVideo = signal<PendingFile | null>(null);
  existingMedia = signal<BullMedia[]>([]);

  imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageInput');
  videoInputRef = viewChild<ElementRef<HTMLInputElement>>('videoInput');
  pdfInputRef = viewChild<ElementRef<HTMLInputElement>>('pdfInput');

  pendingDocument = signal<PendingFile | null>(null);

  existingImages = computed(() => this.existingMedia().filter(m => m.mediaType === 'image'));
  existingVideo = computed(() => this.existingMedia().find(m => m.mediaType === 'video') ?? null);
  existingDocuments = computed(() => this.existingMedia().filter(m => m.mediaType === 'document'));
  totalImages = computed(() => this.existingImages().length + this.pendingImages().length);

  selectedBreedId = signal<string | null>(null);
  breedsOptions = signal<SelectOption[]>([]);
  showSelectErrors = signal(false);
  breedLoading = signal(false);

  model = signal<BullFormModel>({
    name: '',
    breedId: '',
    origin: '',
    code: '',
    description: '',
  });

  bullForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    minLength(s.name, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
    required(s.breedId, { message: 'La raza es requerida' });
    validate(s.origin, ({ value }) =>
      !(value() as string)
        ? { kind: 'required', message: 'El origen es requerido' }
        : undefined,
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.loadBreeds();
    if (id) {
      this.isEditMode.set(true);
      this.bullId.set(id);
      this.loadForEdit(id);
    }
  }

  ngOnDestroy(): void {
    this.pendingImages().forEach(f => URL.revokeObjectURL(f.preview));
    const video = this.pendingVideo();
    if (video) URL.revokeObjectURL(video.preview);
    const doc = this.pendingDocument();
    if (doc) URL.revokeObjectURL(doc.preview);
  }

  onBreedSelected(id: string | null): void {
    this.selectedBreedId.set(id);
    this.model.update(m => ({ ...m, breedId: id ?? '' }));
  }

  getMediaUrl(storagePath: string): string {
    return this.bullService.getMediaPublicUrl(storagePath);
  }

  async goToStep2(): Promise<void> {
    this.errorMsg.set(null);
    this.showSelectErrors.set(true);
    submit(this.bullForm, async () => {
      this.savingStep1.set(true);
      try {
        const values = this.model();
        const dto: CreateBullDto | UpdateBullDto = {
          name: values.name,
          breedId: this.selectedBreedId()!,
          origin: values.origin as BullOrigin,
          code: values.code || undefined,
          description: values.description || undefined,
        };
        if (this.isEditMode() && this.bullId()) {
          await this.bullService.updateBull(this.bullId()!, dto);
        } else if (!this.bullId()) {
          const bull = await this.bullService.createBull(dto as CreateBullDto);
          this.bullId.set(bull.id);
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

  openPdfPicker(): void {
    this.pdfInputRef()?.nativeElement.click();
  }

  onPdfSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.addDocumentFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  onPdfDrop(event: DragEvent): void {
    event.preventDefault();
    const file = Array.from(event.dataTransfer?.files ?? []).find(f =>
      PDF_MIME_TYPES.includes(f.type as MimeType),
    );
    if (file) this.addDocumentFile(file);
  }

  removeDocument(): void {
    const doc = this.pendingDocument();
    if (doc) URL.revokeObjectURL(doc.preview);
    this.pendingDocument.set(null);
  }

  async deleteExistingMedia(mediaId: string): Promise<void> {
    try {
      await this.bullService.deleteMedia(mediaId);
      this.existingMedia.update(media => media.filter(m => m.id !== mediaId));
    } catch {
      this.errorMsg.set('No se pudo eliminar el archivo. Intenta de nuevo.');
    }
  }

  async setCover(mediaId: string): Promise<void> {
    const id = this.bullId();
    if (!id) return;
    try {
      await this.bullService.setCoverImage(id, mediaId);
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
    const bullId = this.bullId();
    if (!bullId) {
      this.errorMsg.set('Ocurrió un error inesperado. Vuelve al paso 1.');
      this.saving.set(false);
      return;
    }
    this.uploadFiles(bullId)
      .then(() => this.router.navigate(['/seller/bulls']))
      .catch(() => this.errorMsg.set('Ocurrió un error al subir los archivos. Intenta de nuevo.'))
      .finally(() => this.saving.set(false));
  }

  private loadBreeds(): void {
    this.breedLoading.set(true);
    this.breedService.getAll().subscribe({
      next: (breeds) => {
        this.breedsOptions.set(breeds.map(s => ({ id: s.id, label: s.name })));
        this.breedLoading.set(false);
      },
      error: () => this.breedLoading.set(false),
    });
  }

  private loadForEdit(id: string): void {
    this.loading.set(true);
    this.bullService.getBull(id).subscribe({
      next: (bull) => {
        this.model.set({
          name: bull.name,
          breedId: bull.breedId,
          origin: bull.origin,
          code: bull.code ?? '',
          description: bull.description ?? '',
        });
        this.selectedBreedId.set(bull.breedId);
        this.existingMedia.set(bull.media ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el toro. Intenta de nuevo.');
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
        mediaType: 'image',
        mimeType: f.type as MimeType,
      }));
    this.pendingImages.update(curr => [...curr, ...valid]);
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

  private async uploadFiles(bullId: string): Promise<void> {
    const allFiles: PendingFile[] = [
      ...this.pendingImages(),
      ...(this.pendingVideo() ? [this.pendingVideo()!] : []),
      ...(this.pendingDocument() ? [this.pendingDocument()!] : []),
    ];
    if (allFiles.length === 0) return;

    for (let i = 0; i < allFiles.length; i++) {
      const pending = allFiles[i];
      await this.bullService.uploadBullMedia(
        bullId,
        pending.file,
        pending.mediaType,
        i === 0 && pending.mediaType === 'image' && this.existingImages().length === 0,
      );
      this.uploadProgress.set(Math.round(((i + 1) / allFiles.length) * 100));
    }
  }
}
