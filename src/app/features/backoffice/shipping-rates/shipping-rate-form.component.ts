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
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ShippingRateService } from '../../../core/services/shipping-rate.service';
import { CreateShippingRateDto } from '../../../core/models/shipping-rate.model';
import { LocationService } from '../../../core/services/location.service';
import {
  SearchSelectComponent,
  SelectOption,
} from '../../../shared/components/search-select/search-select.component';

interface ShippingRateFormModel {
  baseRate: string;
}

@Component({
  selector: 'app-shipping-rate-form',
  imports: [RouterLink, FormField, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/shipping-rates"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEdit() ? 'Editar Tarifa de Envío' : 'Nueva Tarifa de Envío' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEdit() ? 'Actualiza los datos de la tarifa' : 'Completa los datos para crear una nueva tarifa' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información de la tarifa</h2>

            <!-- Origen y Destino -->
            <div class="grid grid-cols-2 gap-4">
              <app-search-select
                label="Origen"
                [required]="true"
                placeholder="Buscar departamento"
                errorMessage="El origen es requerido"
                [options]="stateOptions()"
                [value]="selectedOriginId()"
                [loading]="statesLoading()"
                [showError]="showSelectErrors()"
                (valueChange)="selectedOriginId.set($event)"
              />
              <app-search-select
                label="Destino"
                [required]="true"
                placeholder="Buscar departamento"
                errorMessage="El destino es requerido"
                [options]="stateOptions()"
                [value]="selectedDestinationId()"
                [loading]="statesLoading()"
                [showError]="showSelectErrors()"
                (valueChange)="selectedDestinationId.set($event)"
              />
            </div>

            <!-- Tarifa Base -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Tarifa Base (COP) <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  [formField]="rateForm.baseRate"
                  placeholder="0.00"
                  class="w-full border border-gray-200 rounded-xl pl-7 pr-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
              @if (rateForm.baseRate().touched() && rateForm.baseRate().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ rateForm.baseRate().errors()[0].message }}
                </p>
              }
            </div>
          </div>

          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/admin/shipping-rates"
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
                {{ isEdit() ? 'Guardar cambios' : 'Crear tarifa' }}
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class ShippingRateFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ShippingRateService);
  private locationService = inject(LocationService);

  rateId = signal<string | null>(null);
  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  stateOptions = signal<SelectOption[]>([]);
  statesLoading = signal(false);
  selectedOriginId = signal<string | null>(null);
  selectedDestinationId = signal<string | null>(null);
  showSelectErrors = signal(false);

  model = signal<ShippingRateFormModel>({ baseRate: '' });

  rateForm = form(this.model, (s) => {
    validate(s.baseRate, ({ value }) => {
      const v = String(value() ?? '').trim();
      if (!v) return { kind: 'required', message: 'La tarifa es requerida' };
      const n = parseFloat(v);
      if (isNaN(n) || n < 0) return { kind: 'min', message: 'La tarifa debe ser un número mayor o igual a 0' };
      return undefined;
    });
  });

  ngOnInit(): void {
    this.loadStates();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.rateId.set(id);
      this.isEdit.set(true);
      this.loadRate(id);
    }
  }

  private loadStates(): void {
    this.statesLoading.set(true);
    this.locationService.getStates().subscribe({
      next: (states) => {
        this.stateOptions.set(states.map((s) => ({ id: s.id, label: s.name })));
        this.statesLoading.set(false);
      },
      error: () => this.statesLoading.set(false),
    });
  }

  private loadRate(id: string): void {
    this.loading.set(true);
    this.service.getOne(id).subscribe({
      next: (r) => {
        this.model.set({ baseRate: String(r.baseRate) });
        this.selectedOriginId.set(r.origin?.id ?? null);
        this.selectedDestinationId.set(r.destination?.id ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar la tarifa. Intenta de nuevo.');
      },
    });
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    this.showSelectErrors.set(true);

    if (!this.selectedOriginId() || !this.selectedDestinationId()) return;

    submit(this.rateForm, async () => {
      this.saving.set(true);
      try {
        const dto: CreateShippingRateDto = {
          originId: this.selectedOriginId()!,
          destinationId: this.selectedDestinationId()!,
          baseRate: parseFloat(this.model().baseRate),
        };

        if (this.isEdit()) {
          await firstValueFrom(this.service.update(this.rateId()!, dto));
        } else {
          await firstValueFrom(this.service.create(dto));
        }

        this.router.navigate(['/admin/shipping-rates']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        if (status === 409) {
          this.errorMsg.set('Ya existe una tarifa para ese origen y destino.');
        } else {
          this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }
}
