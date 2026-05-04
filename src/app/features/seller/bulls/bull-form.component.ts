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
import { DecimalPipe } from '@angular/common';
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
import { BullService } from '../../../core/services/bull.service';
import {
  BullMedia,
  BullStraw,
  BullOrigin,
  BullRegistrationType,
  CreateBullDto,
  CreateBullStrawDto,
  StrawType,
  UpdateBullDto,
  UpdateBullStrawDto,
} from '../../../core/models/bull.model';
import { MimeType } from '../../../core/models/upload.model';
import { environment } from '../../../../environments/environment';
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
  mediaType: 'image' | 'video';
  mimeType: MimeType;
}

const IMAGE_MIME_TYPES: MimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_MIME_TYPES: MimeType[] = ['video/mp4', 'video/webm'];

@Component({
  selector: 'app-bull-form',
  imports: [RouterLink, FormField, DecimalPipe, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-6">

      <!-- Page header -->
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
        <!-- Step 1 -->
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

        <!-- Step 2 -->
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >
            @if (currentStep() > 2) {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            } @else { 2 }
          </div>
          <span class="text-sm font-medium" [class]="currentStep() >= 2 ? 'text-gray-800' : 'text-gray-400'">
            Pajillas
          </span>
        </div>

        <div class="flex-1 mx-3 h-px transition-all" [class]="currentStep() > 2 ? 'bg-primary' : 'bg-gray-200'"></div>

        <!-- Step 3 -->
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            [class]="currentStep() >= 3 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'"
          >
            3
          </div>
          <span class="text-sm font-medium" [class]="currentStep() >= 3 ? 'text-gray-800' : 'text-gray-400'">
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

        <!-- Generic error -->
        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ errorMsg() }}
          </div>
        }

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- ===== STEP 1: Información básica ===== -->
          @if (currentStep() === 1) {
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información básica</h2>

              <!-- Nombre -->
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
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ bullForm.name().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Descripción -->
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

            <!-- Información genética -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información genética</h2>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <!-- Código genético -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Numero de registro</label>
                  <input
                    type="text"
                    [formField]="bullForm.code"
                    placeholder="Ej. BRH-2023-001"
                    class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                </div>
                <!-- Raza -->
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
                <!-- Origen -->
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
                    <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                      </svg>
                      {{ bullForm.origin().errors()[0].message }}
                    </p>
                  }
                </div>
              </div>
            </div>

            <!-- Step 1 actions -->
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

          <!-- ===== STEP 2: Pajillas ===== -->
          @if (currentStep() === 2) {
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Pajillas</h2>
                  <p class="text-xs text-gray-400 mt-0.5">Agrega los tipos de pajillas disponibles para este toro</p>
                </div>
                @if (straws().length > 0) {
                  <span class="text-xs text-gray-400">{{ straws().length }} pajilla(s)</span>
                }
              </div>

              <!-- Straw list -->
              @if (straws().length > 0) {
                <div class="space-y-3">
                  @for (straw of straws(); track straw.id) {
                    <div class="border border-gray-100 rounded-xl p-4">
                      @if (editingStrawId() === straw.id) {
                        <!-- Inline edit form -->
                        <div class="space-y-3">
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <label class="block text-xs font-medium text-gray-600 mb-1">Precio (COP)</label>
                              <input
                                type="number"
                                [value]="strawEditPrice()"
                                (input)="strawEditPrice.set(+($any($event.target).value))"
                                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                              />
                            </div>
                            <div>
                              <label class="block text-xs font-medium text-gray-600 mb-1">Stock</label>
                              <input
                                type="number"
                                [value]="strawEditStock()"
                                (input)="strawEditStock.set(+($any($event.target).value))"
                                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                              />
                            </div>
                            <div>
                              <label class="block text-xs font-medium text-gray-600 mb-1">Cantidad mínima</label>
                              <input
                                type="number"
                                [value]="strawEditMinOrder()"
                                (input)="strawEditMinOrder.set(+($any($event.target).value))"
                                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                              />
                            </div>
                          </div>
                          <div class="flex gap-2 justify-end">
                            <button
                              type="button"
                              (click)="cancelEditStraw()"
                              class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              [disabled]="savingStraw()"
                              (click)="saveEditStraw(straw.id)"
                              class="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                            >
                              @if (savingStraw()) { Guardando... } @else { Guardar }
                            </button>
                          </div>
                        </div>
                      } @else {
                        <!-- Straw display -->
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3">
                            <span [class]="'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + strawTypeClass(straw.strawType)">
                              {{ strawTypeLabel(straw.strawType) }}
                            </span>
                            <div class="text-sm">
                              <span class="font-semibold text-gray-900">\${{ straw.price | number:'1.0-0' }}</span>
                              <span class="text-gray-400 mx-1.5">·</span>
                              <span class="text-gray-500">Stock: {{ straw.stockQuantity }}</span>
                              <span class="text-gray-400 mx-1.5">·</span>
                              <span class="text-gray-500">Mín: {{ straw.minOrderQuantity }}</span>
                            </div>
                          </div>
                          <div class="flex items-center gap-1">
                            <button
                              type="button"
                              (click)="startEditStraw(straw)"
                              class="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
                              title="Editar"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              (click)="removeStraw(straw.id)"
                              class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Eliminar"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Add straw form -->
              @if (showAddStraw()) {
                <div class="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
                  <h3 class="text-xs font-semibold text-gray-700 uppercase tracking-wider">Nueva pajilla</h3>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="col-span-2">
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Tipo <span class="text-red-400">*</span>
                      </label>
                      <select
                        [value]="newStrawType()"
                        (change)="newStrawType.set($any($event.target).value)"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                      >
                        <option value="">Selecciona tipo</option>
                        <option value="CONVENTIONAL">Convencional</option>
                        <option value="SEXADO_MALE">Sexado Macho</option>
                        <option value="SEXADO_FEMALE">Sexado Hembra</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Precio COP <span class="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        [value]="newStrawPrice()"
                        (input)="newStrawPrice.set(+($any($event.target).value))"
                        placeholder="250000"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Stock inicial <span class="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        [value]="newStrawStock()"
                        (input)="newStrawStock.set(+($any($event.target).value))"
                        placeholder="100"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Cantidad mínima <span class="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        [value]="newStrawMinOrder()"
                        (input)="newStrawMinOrder.set(+($any($event.target).value))"
                        placeholder="5"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                      />
                    </div>
                  </div>
                  @if (strawError()) {
                    <p class="text-red-400 text-xs">{{ strawError() }}</p>
                  }
                  <div class="flex gap-2 justify-end">
                    <button
                      type="button"
                      (click)="showAddStraw.set(false); clearNewStrawForm()"
                      class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      [disabled]="savingStraw()"
                      (click)="addStraw()"
                      class="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      @if (savingStraw()) { Guardando... } @else { Agregar }
                    </button>
                  </div>
                </div>
              } @else {
                <button
                  type="button"
                  (click)="showAddStraw.set(true)"
                  class="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  Agregar tipo de pajilla
                </button>
              }
            </div>

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
                type="button"
                (click)="currentStep.set(3)"
                class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                Siguiente
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          }

          <!-- ===== STEP 3: Archivos ===== -->
          @if (currentStep() === 3) {

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

              <!-- Existing images -->
              @if (existingImages().length > 0) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  @for (media of existingImages(); track media.id) {
                    <div class="relative aspect-square group">
                      <img
                        [src]="getMediaUrl(media.s3Key)"
                        class="w-full h-full object-cover rounded-xl"
                        alt="Imagen del toro"
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

            <!-- Video -->
            <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div>
                <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Video</h2>
                <p class="text-xs text-gray-400 mt-0.5">MP4 o WebM · Máximo 1 video</p>
              </div>

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

            <!-- Step 3 actions -->
            <div class="flex gap-3 justify-between pb-6">
              <button
                type="button"
                (click)="currentStep.set(2)"
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
  savingStraw = signal(false);
  errorMsg = signal<string | null>(null);
  strawError = signal<string | null>(null);
  uploadProgress = signal(0);

  straws = signal<BullStraw[]>([]);
  showAddStraw = signal(false);
  editingStrawId = signal<string | null>(null);

  newStrawType = signal<StrawType | ''>('');
  newStrawPrice = signal(0);
  newStrawStock = signal(0);
  newStrawMinOrder = signal(0);

  strawEditPrice = signal(0);
  strawEditStock = signal(0);
  strawEditMinOrder = signal(0);

  pendingImages = signal<PendingFile[]>([]);
  pendingVideo = signal<PendingFile | null>(null);
  existingMedia = signal<BullMedia[]>([]);

  imageInputRef = viewChild<ElementRef<HTMLInputElement>>('imageInput');
  videoInputRef = viewChild<ElementRef<HTMLInputElement>>('videoInput');

  existingImages = computed(() => this.existingMedia().filter(m => m.mediaType === 'image'));
  existingVideo = computed(() => this.existingMedia().find(m => m.mediaType === 'video') ?? null);

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
    this.loadBreeds()
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
  }

  onBreedSelected(id: string | null): void {
    console.log(id);

    this.selectedBreedId.set(id);
    this.model.update(m => ({ ...m, breedId: id ?? '' }));
    console.log(this.model());

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

  getMediaUrl(key: string): string {
    return `${environment.cdn}/${key}`;
  }

  async goToStep2(): Promise<void> {
    this.errorMsg.set(null);
    console.log('hola', this.model());

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
        console.log(dto);

        if (this.isEditMode() && this.bullId()) {
          await firstValueFrom(this.bullService.updateBull(this.bullId()!, dto));
        } else if (!this.bullId()) {
          const bull = await firstValueFrom(this.bullService.createBull(dto as CreateBullDto));
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

  async addStraw(): Promise<void> {
    this.strawError.set(null);
    const bullId = this.bullId();
    if (!bullId) return;

    if (!this.newStrawType()) {
      this.strawError.set('Selecciona el tipo de pajilla');
      return;
    }
    if (this.newStrawPrice() <= 0) {
      this.strawError.set('El precio debe ser mayor a 0');
      return;
    }
    if (this.newStrawStock() < 0) {
      this.strawError.set('El stock no puede ser negativo');
      return;
    }
    if (this.newStrawMinOrder() <= 0) {
      this.strawError.set('La cantidad mínima debe ser mayor a 0');
      return;
    }

    this.savingStraw.set(true);
    try {
      const dto: CreateBullStrawDto = {
        strawType: this.newStrawType() as StrawType,
        price: this.newStrawPrice(),
        stockQuantity: this.newStrawStock(),
        minOrderQuantity: this.newStrawMinOrder(),
      };
      const straw = await firstValueFrom(this.bullService.createStraw(bullId, dto));
      this.straws.update(list => [...list, straw]);
      this.showAddStraw.set(false);
      this.clearNewStrawForm();
    } catch {
      this.strawError.set('No se pudo agregar la pajilla. Intenta de nuevo.');
    } finally {
      this.savingStraw.set(false);
    }
  }

  startEditStraw(straw: BullStraw): void {
    this.editingStrawId.set(straw.id);
    this.strawEditPrice.set(straw.price);
    this.strawEditStock.set(straw.stockQuantity);
    this.strawEditMinOrder.set(straw.minOrderQuantity);
  }

  cancelEditStraw(): void {
    this.editingStrawId.set(null);
  }

  async saveEditStraw(strawId: string): Promise<void> {
    const bullId = this.bullId();
    if (!bullId) return;
    this.savingStraw.set(true);
    try {
      const dto: UpdateBullStrawDto = {
        price: this.strawEditPrice(),
        stockQuantity: this.strawEditStock(),
        minOrderQuantity: this.strawEditMinOrder(),
      };
      const updated = await firstValueFrom(this.bullService.updateStraw(bullId, strawId, dto));
      this.straws.update(list => list.map(s => s.id === strawId ? updated : s));
      this.editingStrawId.set(null);
    } catch {
      this.errorMsg.set('No se pudo actualizar la pajilla. Intenta de nuevo.');
    } finally {
      this.savingStraw.set(false);
    }
  }

  async removeStraw(strawId: string): Promise<void> {
    const bullId = this.bullId();
    if (!bullId) return;
    try {
      await firstValueFrom(this.bullService.deleteStraw(bullId, strawId));
      this.straws.update(list => list.filter(s => s.id !== strawId));
    } catch {
      this.errorMsg.set('No se pudo eliminar la pajilla. Intenta de nuevo.');
    }
  }

  clearNewStrawForm(): void {
    this.newStrawType.set('');
    this.newStrawPrice.set(0);
    this.newStrawStock.set(0);
    this.newStrawMinOrder.set(0);
    this.strawError.set(null);
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
    const id = this.bullId();
    if (!id) return;
    this.bullService.deleteMedia(id, mediaId).subscribe(() => {
      this.existingMedia.update(media => media.filter(m => m.id !== mediaId));
    });
  }

  setCover(mediaId: string): void {
    const id = this.bullId();
    if (!id) return;
    this.bullService.setCoverImage(id, mediaId).subscribe(() => {
      this.existingMedia.update(media => media.map(m => ({ ...m, isCover: m.id === mediaId })));
    });
  }

  onSubmit(): void {
    if (this.currentStep() !== 3) return;
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

  strawTypeLabel(type: StrawType): string {
    const map: Record<StrawType, string> = {
      CONVENTIONAL: 'Convencional',
      SEXADO_MALE: 'Sexado Macho',
      SEXADO_FEMALE: 'Sexado Hembra',
    };
    return map[type] ?? type;
  }

  strawTypeClass(type: StrawType): string {
    const map: Record<StrawType, string> = {
      CONVENTIONAL: 'bg-blue-50 text-blue-700',
      SEXADO_MALE: 'bg-sky-50 text-sky-700',
      SEXADO_FEMALE: 'bg-pink-50 text-pink-700',
    };
    return map[type] ?? 'bg-gray-100 text-gray-600';
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
        this.straws.set(bull.straws ?? []);
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

  private async uploadFiles(bullId: string): Promise<void> {
    const allFiles: PendingFile[] = [
      ...this.pendingImages(),
      ...(this.pendingVideo() ? [this.pendingVideo()!] : []),
    ];
    if (allFiles.length === 0) return;

    for (let i = 0; i < allFiles.length; i++) {
      const pending = allFiles[i];
      const { uploadUrl, s3Key } = await firstValueFrom(
        this.bullService.requestPresignedUrl(bullId, {
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
        this.bullService.confirmMediaUpload(bullId, {
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
