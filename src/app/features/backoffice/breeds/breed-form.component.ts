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
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { BreedService } from '../../../core/services/breed.service';
import { BreedPurpose, CreateBreedDto } from '../../../core/models/breed.model';

interface BreedFormModel {
  name: string;
  purpose: string;
}

@Component({
  selector: 'app-breed-form',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/breeds"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEdit() ? 'Editar Raza' : 'Nueva Raza' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEdit() ? 'Actualiza los datos de la raza' : 'Completa los datos para crear una nueva raza' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información de la raza</h2>

            <!-- Nombre -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="breedForm.name"
                placeholder="Ej. Holstein"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (breedForm.name().touched() && breedForm.name().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ breedForm.name().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Propósito -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Propósito <span class="text-red-400">*</span>
              </label>
              <select
                [formField]="breedForm.purpose"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-white"
              >
                <option value="">Selecciona un propósito</option>
                <option value="MILK">🐄 Leche</option>
                <option value="MEAT">🐂 Carne</option>
              </select>
              @if (breedForm.purpose().touched() && breedForm.purpose().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ breedForm.purpose().errors()[0].message }}
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
              routerLink="/admin/breeds"
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
                {{ isEdit() ? 'Guardar cambios' : 'Crear raza' }}
              }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class BreedFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(BreedService);

  breedId = signal<string | null>(null);
  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  model = signal<BreedFormModel>({ name: '', purpose: '' });

  breedForm = form(this.model, (s) => {
    required(s.name, { message: 'El nombre es requerido' });
    validate(s.purpose, ({ value }) => {
      const v = String(value() ?? '').trim();
      if (!v) return { kind: 'required', message: 'El propósito es requerido' };
      return undefined;
    });
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.breedId.set(id);
      this.isEdit.set(true);
      this.loadBreed(id);
    }
  }

  private loadBreed(id: string): void {
    this.loading.set(true);
    this.service.getOne(id).subscribe({
      next: (b) => {
        this.model.set({ name: b.name, purpose: b.purpose });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar la raza. Intenta de nuevo.');
      },
    });
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    submit(this.breedForm, async () => {
      this.saving.set(true);
      try {
        const v = this.model();
        const dto: CreateBreedDto = {
          name: v.name,
          purpose: v.purpose as BreedPurpose,
        };

        if (this.isEdit()) {
          await firstValueFrom(this.service.update(this.breedId()!, dto));
        } else {
          await firstValueFrom(this.service.create(dto));
        }

        this.router.navigate(['/admin/breeds']);
      } catch (err) {
        const status = (err as HttpErrorResponse)?.status;
        if (status === 409) {
          this.errorMsg.set('Ya existe una raza con ese nombre.');
        } else {
          this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }
}
