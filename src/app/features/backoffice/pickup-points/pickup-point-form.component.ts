import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  submit,
  required,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { PickupPointService } from '../../../core/services/pickup-point.service';
import { CreatePickupPointDto } from '../../../core/models/pickup-point.model';
import {
  LocationSelectComponent,
  LocationSelection,
} from '../../../shared/components/location-select/location-select.component';

interface PickupPointFormModel {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
}

@Component({
  selector: 'app-pickup-point-form',
  imports: [RouterLink, FormField, LocationSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/pickup-points"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEdit() ? 'Editar Punto de Recogida' : 'Nuevo Punto de Recogida' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEdit() ? 'Actualiza los datos del punto' : 'Completa los datos para crear un nuevo punto' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2]; track $index) {
            <div class="h-40 bg-gray-100 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <!-- Información del punto -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información del punto</h2>

            <!-- Nombre -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="pointForm.name"
                placeholder="Ej. Centro de Distribución Bogotá"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (pointForm.name().touched() && pointForm.name().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ pointForm.name().errors()[0].message }}
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

            <!-- Dirección -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Dirección <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="pointForm.address"
                placeholder="Ej. Calle 100 # 15-20, Zona Industrial"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (pointForm.address().touched() && pointForm.address().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ pointForm.address().errors()[0].message }}
                </p>
              }
            </div>
          </div>

          <!-- Coordenadas (opcionales) -->
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">
              Coordenadas <span class="text-gray-400 font-normal normal-case">(opcional)</span>
            </h2>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Latitud</label>
                <input
                  type="number"
                  step="any"
                  [formField]="pointForm.latitude"
                  placeholder="Ej. 4.7110"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Longitud</label>
                <input
                  type="number"
                  step="any"
                  [formField]="pointForm.longitude"
                  placeholder="Ej. -74.0721"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Generic error -->
          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/admin/pickup-points"
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
                {{ isEdit() ? 'Guardar cambios' : 'Crear punto' }}
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class PickupPointFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PickupPointService);

  pointId = signal<string | null>(null);
  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  initialStateId = signal<string | null>(null);
  initialCityId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);
  showLocationErrors = signal(false);

  model = signal<PickupPointFormModel>({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });

  pointForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    required(s.address, { message: 'La dirección es requerida' });
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.pointId.set(id);
      this.isEdit.set(true);
      this.loadPoint(id);
    }
  }

  onLocationChange(selection: LocationSelection | null): void {
    this.selectedCityId.set(selection?.cityId ?? null);
  }

  private loadPoint(id: string): void {
    this.loading.set(true);
    this.service.getOne(id).subscribe({
      next: (p) => {
        this.model.set({
          name: p.name,
          address: p.address,
          latitude: p.latitude != null ? String(p.latitude) : '',
          longitude: p.longitude != null ? String(p.longitude) : '',
        });
        this.initialCityId.set(p.city?.id ?? null);
        this.selectedCityId.set(p.city?.id ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar el punto. Intenta de nuevo.');
      },
    });
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    this.showLocationErrors.set(true);

    if (!this.selectedCityId()) return;

    submit(this.pointForm, async () => {
      this.saving.set(true);
      try {
        const v = this.model();
        const dto: CreatePickupPointDto = {
          name: v.name,
          cityId: this.selectedCityId()!,
          address: v.address,
          ...(v.latitude ? { latitude: parseFloat(v.latitude) } : {}),
          ...(v.longitude ? { longitude: parseFloat(v.longitude) } : {}),
        };

        if (this.isEdit()) {
          await firstValueFrom(this.service.update(this.pointId()!, dto));
        } else {
          await firstValueFrom(this.service.create(dto));
        }

        this.router.navigate(['/admin/pickup-points']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        if (status === 409) {
          this.errorMsg.set('Ya existe un punto con ese nombre.');
        } else {
          this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }
}
