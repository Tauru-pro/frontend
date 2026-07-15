import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OnboardingSurveyService } from '../../../core/services/onboarding-survey.service';
import { SurveyInputType } from '../../../core/models/onboarding-survey.model';

@Component({
  selector: 'app-survey-question-form',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="flex items-center gap-4">
        <a routerLink="/admin/onboarding-survey" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">{{ isEdit() ? 'Editar pregunta' : 'Nueva pregunta' }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">Configura una pregunta de la encuesta de proveedores</p>
        </div>
      </div>

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else {
        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Pregunta <span class="text-red-400">*</span></label>
            <input type="text" [value]="prompt()" (input)="prompt.set($any($event.target).value)"
              placeholder="Ej. ¿Qué tipo de ganado manejas?"
              class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Tipo de respuesta</label>
              <select [value]="inputType()" (change)="inputType.set($any($event.target).value)"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all">
                <option value="SINGLE_CHOICE">Opción única</option>
                <option value="MULTI_CHOICE">Opción múltiple</option>
                <option value="TEXT">Texto</option>
                <option value="NUMBER">Número</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Orden</label>
              <input type="number" [value]="position()" (input)="position.set(toInt($any($event.target).value))"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
            </div>
          </div>

          @if (isChoice()) {
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Opciones</label>
              <div class="space-y-2">
                @for (opt of options(); track $index) {
                  <div class="flex items-center gap-2">
                    <input type="text" [value]="opt" (input)="updateOption($index, $any($event.target).value)"
                      placeholder="Texto de la opción"
                      class="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
                    <button type="button" (click)="removeOption($index)" class="p-2 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Quitar">✕</button>
                  </div>
                }
              </div>
              <button type="button" (click)="addOption()" class="mt-2 text-sm text-primary hover:text-accent font-medium">+ Agregar opción</button>
              @if (showErrors() && isChoice() && validOptions().length === 0) {
                <p class="text-red-400 text-xs mt-1.5">Agrega al menos una opción.</p>
              }
            </div>
          }

          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" [checked]="isRequired()" (change)="isRequired.set($any($event.target).checked)" class="accent-primary rounded" />
              Obligatoria
            </label>
            <label class="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" [checked]="isActive()" (change)="isActive.set($any($event.target).checked)" class="accent-primary rounded" />
              Activa
            </label>
          </div>
        </div>

        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{{ errorMsg() }}</div>
        }

        <div class="flex gap-3 justify-end pb-6">
          <a routerLink="/admin/onboarding-survey" class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</a>
          <button type="button" (click)="onSubmit()" [disabled]="saving()" class="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {{ saving() ? 'Guardando…' : (isEdit() ? 'Guardar cambios' : 'Crear pregunta') }}
          </button>
        </div>
      }
    </div>
  `,
})
export default class SurveyQuestionFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(OnboardingSurveyService);

  id = signal<string | null>(null);
  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  showErrors = signal(false);

  prompt = signal('');
  inputType = signal<SurveyInputType>('SINGLE_CHOICE');
  options = signal<string[]>(['']);
  position = signal(0);
  isRequired = signal(false);
  isActive = signal(true);

  isChoice = computed(() => this.inputType() === 'SINGLE_CHOICE' || this.inputType() === 'MULTI_CHOICE');
  validOptions = computed(() => this.options().map((o) => o.trim()).filter((o) => o.length > 0));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.id.set(id);
      this.isEdit.set(true);
      this.load(id);
    }
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const q = await firstValueFrom(this.service.getOne(id));
      this.prompt.set(q.prompt);
      this.inputType.set(q.inputType);
      this.options.set(q.options.length ? q.options : ['']);
      this.position.set(q.position);
      this.isRequired.set(q.isRequired);
      this.isActive.set(q.isActive);
    } catch {
      this.errorMsg.set('No se pudo cargar la pregunta. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  toInt(v: string): number {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  addOption(): void {
    this.options.update((o) => [...o, '']);
  }

  removeOption(i: number): void {
    this.options.update((o) => o.filter((_, idx) => idx !== i));
  }

  updateOption(i: number, value: string): void {
    this.options.update((o) => o.map((v, idx) => (idx === i ? value : v)));
  }

  async onSubmit(): Promise<void> {
    this.errorMsg.set(null);
    this.showErrors.set(true);
    if (!this.prompt().trim()) {
      this.errorMsg.set('La pregunta es requerida.');
      return;
    }
    if (this.isChoice() && this.validOptions().length === 0) {
      this.errorMsg.set('Agrega al menos una opción.');
      return;
    }

    this.saving.set(true);
    try {
      const dto = {
        prompt: this.prompt().trim(),
        inputType: this.inputType(),
        options: this.isChoice() ? this.validOptions() : [],
        position: this.position(),
        isRequired: this.isRequired(),
        isActive: this.isActive(),
      };
      if (this.isEdit()) {
        await this.service.update(this.id()!, dto);
      } else {
        await this.service.create(dto);
      }
      this.router.navigate(['/admin/onboarding-survey']);
    } catch {
      this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
