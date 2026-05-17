import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  form,
  FormField,
  submit,
  required,
  minLength,
  maxLength,
  min,
  max,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { MarketplaceSettingsService } from '../../../core/services/marketplace-settings.service';
import { UpdateMarketplaceSettingsDto } from '../../../core/models/marketplace-settings.model';
import { environment } from '../../../../environments/environment';

interface SettingsFormModel {
  name: string;
  commissionPercentage: number;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

@Component({
  selector: 'app-marketplace-settings',
  standalone: true,
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <div>
        <h1 class="text-xl font-bold text-gray-900">Configuración del marketplace</h1>
        <p class="text-sm text-gray-500 mt-0.5">Administra la información básica y configuración general</p>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- Logo -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Logo del marketplace</h2>

            <div class="flex items-start gap-5">
              <div class="flex-shrink-0">
                @if (logoPreview()) {
                  <img
                    [src]="logoPreview()!"
                    alt="Logo"
                    class="w-20 h-20 rounded-2xl object-cover border border-gray-200"
                  />
                } @else {
                  <div class="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                }
              </div>

              <div class="flex-1 space-y-3">
                <label
                  for="logo-upload"
                  class="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 cursor-pointer hover:border-primary/30 hover:bg-gray-50 transition-all"
                  [class.border-primary]="isDragging()"
                  [class.bg-blue-50]="isDragging()"
                  (dragover)="$event.preventDefault(); isDragging.set(true)"
                  (dragleave)="isDragging.set(false)"
                  (drop)="onDrop($event)"
                >
                  @if (uploading()) {
                    <svg class="animate-spin w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span class="text-sm text-gray-500">Subiendo imagen...</span>
                  } @else {
                    <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <span class="text-sm text-gray-500">
                      <span class="font-medium text-primary">Selecciona</span> o arrastra una imagen
                    </span>
                  }
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  class="hidden"
                  (change)="onFileSelected($event)"
                />
                <p class="text-xs text-gray-400">JPG, PNG, WEBP o AVIF · Máx. 5 MB</p>

                @if (uploadError()) {
                  <p class="text-red-400 text-xs flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ uploadError() }}
                  </p>
                }
              </div>
            </div>
          </div>

          <!-- Información general -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información general</h2>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre del marketplace <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="settingsForm.name"
                placeholder="Ej. Tauru Pro"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (settingsForm.name().touched() && settingsForm.name().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ settingsForm.name().errors()[0].message }}
                </p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Comisión de ventas (%)
              </label>
              <input
                type="number"
                [formField]="settingsForm.commissionPercentage"
                placeholder="Ej. 5.5"
                step="0.01"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (settingsForm.commissionPercentage().touched() && settingsForm.commissionPercentage().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ settingsForm.commissionPercentage().errors()[0].message }}
                </p>
              }
              <p class="text-xs text-gray-400 mt-1">Porcentaje aplicado a cada venta realizada (0–100)</p>
            </div>
          </div>

          <!-- SEO -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">SEO</h2>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Título SEO</label>
              <input
                type="text"
                [formField]="settingsForm.seoTitle"
                placeholder="Ej. Compra genética bovina premium"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (settingsForm.seoTitle().touched() && settingsForm.seoTitle().errors().length) {
                <p class="text-red-400 text-xs mt-1.5">{{ settingsForm.seoTitle().errors()[0].message }}</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción SEO</label>
              <textarea
                [formField]="settingsForm.seoDescription"
                placeholder="Ej. El marketplace líder en genética bovina..."
                rows="3"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all resize-none"
              ></textarea>
              @if (settingsForm.seoDescription().touched() && settingsForm.seoDescription().errors().length) {
                <p class="text-red-400 text-xs mt-1.5">{{ settingsForm.seoDescription().errors()[0].message }}</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Palabras clave SEO</label>
              <input
                type="text"
                [formField]="settingsForm.seoKeywords"
                placeholder="Ej. ganado, genética, semen"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (settingsForm.seoKeywords().touched() && settingsForm.seoKeywords().errors().length) {
                <p class="text-red-400 text-xs mt-1.5">{{ settingsForm.seoKeywords().errors()[0].message }}</p>
              }
              <p class="text-xs text-gray-400 mt-1">Separadas por coma</p>
            </div>
          </div>

          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          @if (successMsg()) {
            <div class="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              {{ successMsg() }}
            </div>
          }

          <div class="flex justify-end pb-6">
            <button
              type="submit"
              [disabled]="saving() || uploading()"
              class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              @if (saving()) {
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Guardando...
              } @else {
                Guardar cambios
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class MarketplaceSettingsComponent implements OnInit {
  private settingsService = inject(MarketplaceSettingsService);

  loading = signal(false);
  saving = signal(false);
  uploading = signal(false);
  isDragging = signal(false);
  logoPreview = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  model = signal<SettingsFormModel>({
    name: '',
    commissionPercentage: 0,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
  });

  settingsForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre del marketplace es requerido' });
    minLength(s.name, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
    maxLength(s.name, 100, { message: 'El nombre no puede superar 100 caracteres' });
    min(s.commissionPercentage, 0, { message: 'La comisión no puede ser negativa' });
    max(s.commissionPercentage, 100, { message: 'La comisión no puede superar el 100%' });
    maxLength(s.seoTitle, 160, { message: 'El título SEO no puede superar 160 caracteres' });
    maxLength(s.seoDescription, 500, { message: 'La descripción SEO no puede superar 500 caracteres' });
    maxLength(s.seoKeywords, 255, { message: 'Las palabras clave no pueden superar 255 caracteres' });
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    this.loading.set(true);
    try {
      const settings = await firstValueFrom(this.settingsService.getSettings());
      this.model.set({
        name: settings.name ?? '',
        commissionPercentage: settings.commissionPercentage ?? 0,
        seoTitle: settings.seoTitle ?? '',
        seoDescription: settings.seoDescription ?? '',
        seoKeywords: settings.seoKeywords ?? '',
      });
      if (settings.logoKey) {
        this.logoPreview.set(`${environment.cdn}/${settings.logoKey}`);
      }
    } catch {
      this.errorMsg.set('No se pudo cargar la configuración. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  private processFile(file: File): void {
    this.uploadError.set(null);
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) {
      this.uploadError.set('Solo se permiten imágenes JPG, PNG, WEBP o AVIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('La imagen no puede superar los 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => this.logoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.uploadToS3(file);
  }

  private async uploadToS3(file: File): Promise<void> {
    this.uploading.set(true);
    try {
      const { uploadUrl, s3Key } = await firstValueFrom(
        this.settingsService.requestLogoUpload(file.type),
      );
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!response.ok) {
        this.uploadError.set('No se pudo subir la imagen. Intenta de nuevo.');
        return;
      }
      await firstValueFrom(this.settingsService.confirmLogoUpload(s3Key));
    } catch {
      this.uploadError.set('Error al subir la imagen. Intenta de nuevo.');
    } finally {
      this.uploading.set(false);
    }
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    submit(this.settingsForm, async () => {
      this.saving.set(true);
      try {
        const values = this.model();
        const dto: UpdateMarketplaceSettingsDto = {
          name: values.name,
          commissionPercentage: values.commissionPercentage,
          seoTitle: values.seoTitle || undefined,
          seoDescription: values.seoDescription || undefined,
          seoKeywords: values.seoKeywords || undefined,
        };
        await firstValueFrom(this.settingsService.updateSettings(dto));
        this.successMsg.set('Configuración guardada correctamente.');
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        this.errorMsg.set(
          status === 403
            ? 'No tienes permisos para modificar la configuración.'
            : 'Ocurrió un error al guardar. Intenta de nuevo.',
        );
      } finally {
        this.saving.set(false);
      }
    });
  }
}
