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
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { SellerService } from '../../../core/services/seller.service';
import { UpdateSellerProfileDto } from '../../../core/models/user.model';
import { UserStore } from '../../../core/store/user.store';
import { environment } from '../../../../environments/environment';
import { LocationSelectComponent, LocationSelection } from '../../../shared/components/location-select/location-select.component';

interface SettingsFormModel {
  bussinesName: string;
  contactPhone: string;
  cityId: string;
  address: string;
}

@Component({
  selector: 'app-seller-settings',
  standalone: true,
  imports: [FormField, LocationSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Page header -->
      <div>
        <h1 class="text-xl font-bold text-gray-900">Configuración</h1>
        <p class="text-sm text-gray-500 mt-0.5">Actualiza la información de tu negocio</p>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- Logo del negocio -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Logo del negocio</h2>

            <div class="flex items-start gap-5">
              <!-- Preview -->
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

              <!-- Upload area -->
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
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  (change)="onFileSelected($event)"
                />
                <p class="text-xs text-gray-400">JPG, PNG o WEBP  Max. 5 MB</p>

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

          <!-- InformaciÃ³n del negocio -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información del negocio</h2>

            <!-- Nombre del negocio -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre del negocio <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="settingsForm.bussinesName"
                placeholder="Ej. GenÃ©tica Bovina del Valle"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (settingsForm.bussinesName().touched() && settingsForm.bussinesName().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ settingsForm.bussinesName().errors()[0].message }}
                </p>
              }
            </div>
         <!-- Departamento y Municipio -->
            <app-location-select
              [initialStateId]="initialStateId()"
              [initialCityId]="initialCityId()"
              [showErrors]="showLocationErrors()"
              (selectionChange)="onLocationChange($event)"
            />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <!-- TelÃ©fono de contacto -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Teléfono de contacto</label>
                <input
                  type="tel"
                  [formField]="settingsForm.contactPhone"
                  placeholder="+57 300 000 0000"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
            <!-- Dirección -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label>
              <input
                type="text"
                [formField]="settingsForm.address"
                placeholder="Ej. Cra 15 #45-67, Zona Industrial"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
          
            </div>

           
          </div>

          <!-- Error genÃ©rico -->
          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <!-- Ã‰xito -->
          @if (successMsg()) {
            <div class="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              {{ successMsg() }}
            </div>
          }

          <!-- Acciones -->
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
export default class SellerSettingsComponent implements OnInit {
  private sellerService = inject(SellerService);
  private userStore = inject(UserStore);


  initialStateId = signal<string | null>(null);
  initialCityId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);
  logoPreview = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  showLocationErrors = signal(false);

  isDragging = signal(false);
  uploading = signal(false);
  loading = signal(false);
  saving = signal(false);
  logoKey = signal('');

  model = signal<SettingsFormModel>({
    bussinesName: '',
    contactPhone: '',
    cityId: '',
    address: '',
  });

  settingsForm = form(this.model, (s) => {
    required(s.bussinesName, { message: 'El nombre del negocio es requerido' });
    minLength(s.bussinesName, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    const cached = this.userStore.user();
    if (cached) {
      this.populateForm(cached);
      return;
    }
  }

  private populateForm(profile: ReturnType<typeof this.userStore.user>): void {
    if (!profile) return;
    this.initialStateId.set(profile.sellerProfile?.city?.state?.id!)
    this.initialCityId.set(profile.sellerProfile?.city?.id!)
    this.model.set({
      bussinesName: profile.sellerProfile?.bussinesName ?? '',
      contactPhone: profile.sellerProfile?.contactPhone ?? '',
      cityId: profile.sellerProfile?.city?.id ?? '',
      address: profile.sellerProfile?.address ?? '',
    });
    this.logoKey.set(profile.sellerProfile?.logoKey ?? '');
    if (profile.sellerProfile?.logoKey) {
      this.logoPreview.set(this.logoUrl(profile.sellerProfile?.logoKey));
    }
  }

  private logoUrl(key: string): string {
    return `${environment.cdn}/${key}`;
  }

  onLocationChange(selection: LocationSelection | null): void {
    this.selectedCityId.set(selection?.cityId ?? null);
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

    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Solo se permiten imÃ¡genes (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('La imagen no puede superar los 5 MB.');
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => this.logoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);

    this.uploadToS3(file);
  }

  private async uploadToS3(file: File): Promise<void> {
    this.uploading.set(true);

    const { uploadUrl, s3Key } = await firstValueFrom(
      this.sellerService.getPresignedUrl(file.type)
    );
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!response.ok) {
      this.uploading.set(false);
      throw new Error(`No se pudo subir ${file.name}`);
    }
    await firstValueFrom(
      this.sellerService.confirm(s3Key),
    );
    this.uploading.set(false);
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    submit(this.settingsForm, async () => {
      this.saving.set(true);
      try {
        const values = this.model();
        const dto: UpdateSellerProfileDto = {
          bussinesName: values.bussinesName,
          contactPhone: values.contactPhone || undefined,
          cityId: this.selectedCityId()!,
          address: values.address || undefined
        };
        const updated = await firstValueFrom(this.sellerService.updateMyProfile(dto));
        this.userStore.patchSellerProfile(updated);
        this.successMsg.set('Cambios guardados correctamente.');
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        this.errorMsg.set(
          status === 404
            ? 'No se encontrÃ³ el perfil. Contacta al administrador.'
            : 'OcurriÃ³ un error al guardar. Intenta de nuevo.',
        );
      } finally {
        this.saving.set(false);
      }
    });
  }
}

