import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingSurveyService } from '../../../core/services/onboarding-survey.service';
import { SurveyQuestion } from '../../../core/models/onboarding-survey.model';
import {
  DataTableComponent,
  TableEmptyDirective,
  TableCellDirective,
  TableColumn,
} from '../../../shared/components/data-table/data-table.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

const TYPE_LABELS: Record<SurveyQuestion['inputType'], string> = {
  SINGLE_CHOICE: 'Opción única',
  MULTI_CHOICE: 'Opción múltiple',
  TEXT: 'Texto',
  NUMBER: 'Número',
};

@Component({
  selector: 'app-onboarding-survey',
  imports: [DataTableComponent, TableEmptyDirective, TableCellDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Encuesta de proveedores</h1>
          <p class="text-sm text-gray-500 mt-0.5">Define las preguntas de segmentación del onboarding</p>
        </div>
        <app-button iconPath="M12 4v16m8-8H4" (clicked)="router.navigate(['/admin/onboarding-survey/new'])">
          Nueva pregunta
        </app-button>
      </div>

      @if (errorMsg()) {
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{{ errorMsg() }}</div>
      }

      <app-data-table
        [columns]="columns"
        [rows]="items()"
        [loading]="loading()"
        [page]="1"
        [totalPages]="1"
        [total]="items().length"
        itemLabel="preguntas"
      >
        <ng-template tableCell="prompt" let-item>
          <span class="text-sm font-medium text-gray-900">{{ item.prompt }}</span>
        </ng-template>

        <ng-template tableCell="inputType" let-item>
          <span class="text-sm text-gray-600">{{ typeLabel(item.inputType) }}</span>
        </ng-template>

        <ng-template tableCell="isRequired" let-item>
          <span class="text-xs" [class.text-gray-700]="item.isRequired" [class.text-gray-300]="!item.isRequired">
            {{ item.isRequired ? 'Sí' : 'No' }}
          </span>
        </ng-template>

        <ng-template tableCell="isActive" let-item>
          <span
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
            [class.bg-green-50]="item.isActive"
            [class.text-green-700]="item.isActive"
            [class.bg-gray-100]="!item.isActive"
            [class.text-gray-500]="!item.isActive"
          >
            {{ item.isActive ? 'Activa' : 'Inactiva' }}
          </span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <div class="flex items-center gap-2">
            <button
              (click)="router.navigate(['/admin/onboarding-survey', item.id, 'edit'])"
              class="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Editar
            </button>
            <button
              (click)="onDelete(item)"
              class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </ng-template>

        <ng-template tableEmpty>
          <div class="py-16 flex flex-col items-center text-center px-6">
            <p class="text-gray-800 font-semibold mb-1">Sin preguntas</p>
            <p class="text-gray-400 text-sm mb-5">Crea la primera pregunta de la encuesta de proveedores.</p>
            <app-button (clicked)="router.navigate(['/admin/onboarding-survey/new'])">Nueva pregunta</app-button>
          </div>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export default class OnboardingSurveyComponent implements OnInit {
  protected router = inject(Router);
  private service = inject(OnboardingSurveyService);

  readonly columns: TableColumn<SurveyQuestion>[] = [
    { key: 'prompt', label: 'Pregunta', headerClass: 'px-6 py-3', cellClass: 'px-6 py-4' },
    { key: 'inputType', label: 'Tipo' },
    { key: 'isRequired', label: 'Obligatoria' },
    { key: 'isActive', label: 'Estado' },
    { key: 'actions', label: '' },
  ];

  items = signal<SurveyQuestion[]>([]);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  typeLabel(t: SurveyQuestion['inputType']): string {
    return TYPE_LABELS[t];
  }

  load(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.service.getAll().subscribe({
      next: (res) => {
        this.items.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('No se pudieron cargar las preguntas. Intenta de nuevo.');
      },
    });
  }

  async onDelete(item: SurveyQuestion): Promise<void> {
    if (!confirm(`¿Eliminar la pregunta "${item.prompt}"?`)) return;
    try {
      await this.service.delete(item.id);
      this.load();
    } catch {
      this.errorMsg.set('No se pudo eliminar la pregunta. Intenta de nuevo.');
    }
  }
}
