import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  required,
  minLength,
} from '@angular/forms/signals';
import { BranchService } from '../../../core/services/branch.service';
import { CreateBranchDto, UpdateBranchDto } from '../../../core/models/branch.model';
import {
  LocationSelectComponent,
  LocationSelection,
} from '../../../shared/components/location-select/location-select.component';

interface BranchFormModel {
  name: string;
  address: string;
  phone: string;
  latitude: string;
  longitude: string;
  businessHours: string;
}

@Component({
  selector: 'app-branch-form',
  imports: [RouterLink, FormField, LocationSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/seller/branches"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEditMode() ? 'Editar sucursal' : 'Nueva sucursal' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEditMode() ? 'Modifica los datos de la sucursal' : 'Registra una nueva sede de tu negocio' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2]; track $index) {
            <div class="h-32 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información de la sucursal</h2>

            <!-- Nombre -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="branchForm.name"
                placeholder="Ej. Sede Bogotá"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (branchForm.name().touched() && branchForm.name().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ branchForm.name().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Ubicación -->
            <app-location-select
              [initialStateId]="initialStateId()"
              [initialCityId]="initialCityId()"
              [showErrors]="showLocationErrors()"
              (selectionChange)="onLocationChange($event)"
            />

            <!-- Dirección -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Dirección <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="branchForm.address"
                placeholder="Ej. Calle 100 # 15-20"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (branchForm.address().touched() && branchForm.address().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ branchForm.address().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Teléfono -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
              <input
                type="tel"
                [formField]="branchForm.phone"
                placeholder="+57 300 000 0000"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>

            <!-- Horario operativo -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Horario operativo</label>
              <input
                type="text"
                [formField]="branchForm.businessHours"
                placeholder="Lun-Vie 8am-5pm"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>

            <!-- Coordenadas GPS -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Latitud</label>
                <input
                  type="text"
                  inputmode="decimal"
                  [formField]="branchForm.latitude"
                  placeholder="4.710989"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Longitud</label>
                <input
                  type="text"
                  inputmode="decimal"
                  [formField]="branchForm.longitude"
                  placeholder="-74.072090"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>

          @if (locationError()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              Selecciona un departamento y municipio.
            </div>
          }

          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/seller/branches"
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </a>
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
                Guardando...
              } @else {
                {{ isEditMode() ? 'Guardar cambios' : 'Crear sucursal' }}
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class BranchFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private branchService = inject(BranchService);

  isEditMode = signal(false);
  branchId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  locationError = signal(false);
  showLocationErrors = signal(false);
  initialStateId = signal<string | null>(null);
  initialCityId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);

  model = signal<BranchFormModel>({
    name: '',
    address: '',
    phone: '',
    latitude: '',
    longitude: '',
    businessHours: '',
  });

  branchForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    minLength(s.name, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
    required(s.address, { message: 'La dirección es requerida' });
    minLength(s.address, 5, { message: 'La dirección debe tener al menos 5 caracteres' });
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.branchId.set(id);
      this.loadForEdit(id);
    }
  }

  onLocationChange(selection: LocationSelection | null): void {
    this.selectedCityId.set(selection?.cityId ?? null);
    this.locationError.set(false);
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    this.locationError.set(false);

    if (!this.selectedCityId() && !this.isEditMode()) {
      this.showLocationErrors.set(true);
      this.locationError.set(true);
      return;
    }

    submit(this.branchForm, async () => {
      if (!this.selectedCityId() && !this.isEditMode()) {
        this.showLocationErrors.set(true);
        this.locationError.set(true);
        return;
      }
      this.saving.set(true);
      try {
        const values = this.model();
        const latitude = values.latitude.trim() ? Number(values.latitude) : undefined;
        const longitude = values.longitude.trim() ? Number(values.longitude) : undefined;
        if (this.isEditMode()) {
          const dto: UpdateBranchDto = {
            name: values.name,
            address: values.address,
            phone: values.phone || undefined,
            cityId: this.selectedCityId() ?? undefined,
            latitude,
            longitude,
            businessHours: values.businessHours || undefined,
          };
          await this.branchService.updateBranch(this.branchId()!, dto);
        } else {
          const dto: CreateBranchDto = {
            name: values.name,
            address: values.address,
            cityId: this.selectedCityId()!,
            phone: values.phone || undefined,
            latitude,
            longitude,
            businessHours: values.businessHours || undefined,
          };
          await this.branchService.createBranch(dto);
        }
        this.router.navigate(['/seller/branches']);
      } catch (err) {
        this.errorMsg.set(
          err instanceof Error && err.message === 'DUPLICATE_NAME'
            ? 'Ya existe una sucursal con ese nombre.'
            : 'Ocurrió un error al guardar. Intenta de nuevo.',
        );
      } finally {
        this.saving.set(false);
      }
    });
  }

  private loadForEdit(id: string): void {
    this.loading.set(true);
    this.branchService.getBranch(id).subscribe({
      next: (branch) => {
        this.initialStateId.set(branch.city?.state?.id ?? null);
        this.initialCityId.set(branch.city?.id ?? null);
        this.selectedCityId.set(branch.city?.id ?? null);
        this.model.set({
          name: branch.name,
          address: branch.address,
          phone: branch.phone ?? '',
          latitude: branch.latitude !== undefined ? String(branch.latitude) : '',
          longitude: branch.longitude !== undefined ? String(branch.longitude) : '',
          businessHours: branch.businessHours ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar la sucursal. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }
}
