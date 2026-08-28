import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, submit, required } from '@angular/forms/signals';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { CreateSellerSegmentDto } from '../../../core/models/seller-segment.model';

interface SellerSegmentFormModel {
  code: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-seller-segment-form',
  imports: [RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/seller-segments"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ isEdit() ? 'Editar segmento' : 'Nuevo segmento' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ isEdit() ? 'Actualiza el nombre y la descripción del segmento' : 'Define un nuevo segmento comercial' }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else {

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">

          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Información del segmento</h2>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Código <span class="text-red-400">*</span>
              </label>
              @if (isEdit()) {
                <div class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-400 bg-gray-50">
                  {{ model().code }}
                </div>
              } @else {
                <input
                  type="text"
                  [formField]="segmentForm.code"
                  placeholder="Ej. DISTRIBUTOR"
                  class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (segmentForm.code().touched() && segmentForm.code().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5">{{ segmentForm.code().errors()[0].message }}</p>
                }
                <p class="text-xs text-gray-400 mt-1.5">Identificador único, no editable luego de creado.</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="segmentForm.name"
                placeholder="Ej. Distribuidor"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (segmentForm.name().touched() && segmentForm.name().errors().length) {
                <p class="text-red-400 text-xs mt-1.5">{{ segmentForm.name().errors()[0].message }}</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
              <textarea
                [formField]="segmentForm.description"
                rows="3"
                placeholder="Descripción breve del segmento"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none"
              ></textarea>
            </div>
          </div>

          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/admin/seller-segments"
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </a>
            <button
              type="submit"
              [disabled]="saving()"
              class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              @if (saving()) { Guardando... } @else { {{ isEdit() ? 'Guardar cambios' : 'Crear segmento' }} }
            </button>
          </div>

        </form>
      }
    </div>
  `,
})
export default class SellerSegmentFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(SellerSegmentService);

  segmentId = signal<string | null>(null);
  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  model = signal<SellerSegmentFormModel>({ code: '', name: '', description: '' });

  segmentForm = form(this.model, (s) => {
    required(s.code, { message: 'El código es requerido' });
    required(s.name, { message: 'El nombre es requerido' });
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.segmentId.set(id);
      this.isEdit.set(true);
      this.loadSegment(id);
    }
  }

  private loadSegment(id: string): void {
    this.loading.set(true);
    this.service.getOne(id).subscribe({
      next: (s) => {
        this.model.set({ code: s.code, name: s.name, description: s.description ?? '' });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudo cargar el segmento. Intenta de nuevo.');
      },
    });
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    submit(this.segmentForm, async () => {
      this.saving.set(true);
      try {
        const v = this.model();

        if (this.isEdit()) {
          await this.service.update(this.segmentId()!, { name: v.name, description: v.description });
        } else {
          const dto: CreateSellerSegmentDto = {
            code: v.code.trim().toUpperCase(),
            name: v.name,
            description: v.description || undefined,
          };
          await this.service.create(dto);
        }

        this.router.navigate(['/admin/seller-segments']);
      } catch (err) {
        if (err instanceof Error && err.message === 'DUPLICATE_CODE') {
          this.errorMsg.set('Ya existe un segmento con ese código.');
        } else {
          this.errorMsg.set('Ocurrió un error al guardar. Intenta de nuevo.');
        }
      } finally {
        this.saving.set(false);
      }
    });
  }
}
