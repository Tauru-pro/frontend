import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, submit, required, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CommissionRuleService } from '../../../core/services/commission-rule.service';
import { SellerSegmentService } from '../../../core/services/seller-segment.service';
import { CommissionRule } from '../../../core/models/commission-rule.model';
import { SellerSegment } from '../../../core/models/seller-segment.model';

interface CommissionRuleFormModel {
  commissionRate: string;
  effectiveFrom: string;
}

@Component({
  selector: 'app-commission-rule-form',
  imports: [RouterLink, FormField, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <div class="flex items-center gap-4">
        <a
          routerLink="/admin/commission-rules"
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            Comisión — {{ segment()?.name ?? '' }}
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">El historial se conserva; los cambios solo afectan ventas futuras</p>
        </div>
      </div>

      @if (loading()) {
        <div class="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>
      } @else {

        <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Historial</h2>
          <div class="divide-y divide-gray-50">
            @for (rule of history(); track rule.id) {
              <div class="py-3 flex items-center justify-between text-sm">
                <span class="text-gray-600">
                  {{ rule.effectiveFrom | date: 'd MMM y' }}
                  →
                  {{ rule.effectiveUntil ? (rule.effectiveUntil | date: 'd MMM y') : 'actual' }}
                </span>
                <span class="font-semibold" [class.text-primary]="!rule.effectiveUntil" [class.text-gray-400]="!!rule.effectiveUntil">
                  {{ rule.commissionRate }}%
                </span>
              </div>
            } @empty {
              <p class="text-sm text-gray-400 py-2">Sin reglas configuradas todavía.</p>
            }
          </div>
        </div>

        <form (submit)="onSubmit(); $event.preventDefault()" class="space-y-6">
          <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 class="text-sm font-semibold text-gray-800 uppercase tracking-wider">Programar nueva comisión</h2>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nueva comisión (%) <span class="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                [formField]="ruleForm.commissionRate"
                placeholder="Ej. 25"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (ruleForm.commissionRate().touched() && ruleForm.commissionRate().errors().length) {
                <p class="text-red-400 text-xs mt-1.5">{{ ruleForm.commissionRate().errors()[0].message }}</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Vigente desde <span class="text-red-400">*</span>
              </label>
              <input
                type="date"
                [formField]="ruleForm.effectiveFrom"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              <p class="text-xs text-gray-400 mt-1.5">Las ventas anteriores a esta fecha conservan la comisión vigente en su momento.</p>
            </div>
          </div>

          @if (errorMsg()) {
            <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {{ errorMsg() }}
            </div>
          }

          <div class="flex gap-3 justify-end pb-6">
            <a
              routerLink="/admin/commission-rules"
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </a>
            <button type="submit" [disabled]="saving()" class="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
              @if (saving()) { Guardando... } @else { Programar comisión }
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export default class CommissionRuleFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private commissionService = inject(CommissionRuleService);
  private segmentService = inject(SellerSegmentService);

  segmentId = signal<string>('');
  segment = signal<SellerSegment | null>(null);
  history = signal<CommissionRule[]>([]);
  loading = signal(true);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  model = signal<CommissionRuleFormModel>({
    commissionRate: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  ruleForm = form(this.model, (s) => {
    required(s.commissionRate, { message: 'La comisión es requerida' });
    validate(s.commissionRate, ({ value }) => {
      const v = Number(value());
      if (value() !== '' && (!Number.isFinite(v) || v < 0 || v > 100)) {
        return { kind: 'range', message: 'La comisión debe estar entre 0 y 100' };
      }
      return undefined;
    });
    required(s.effectiveFrom, { message: 'La fecha de vigencia es requerida' });
  });

  async ngOnInit(): Promise<void> {
    const segmentId = this.route.snapshot.paramMap.get('segmentId');
    if (!segmentId) return;
    this.segmentId.set(segmentId);
    await this.load(segmentId);
  }

  private async load(segmentId: string): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const [segment, history] = await Promise.all([
        firstValueFrom(this.segmentService.getOne(segmentId)),
        firstValueFrom(this.commissionService.getForSegment(segmentId)),
      ]);
      this.segment.set(segment);
      this.history.set(history.slice().reverse());
    } catch {
      this.errorMsg.set('No se pudo cargar la información de comisión. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  onSubmit(): void {
    this.errorMsg.set(null);
    submit(this.ruleForm, async () => {
      this.saving.set(true);
      try {
        const v = this.model();
        await this.commissionService.scheduleChange({
          segmentId: this.segmentId(),
          commissionRate: Number(v.commissionRate),
          effectiveFrom: new Date(v.effectiveFrom).toISOString(),
        });
        this.router.navigate(['/admin/commission-rules']);
      } catch {
        this.errorMsg.set('Ocurrió un error al programar la comisión. Verifica que la fecha no se solape con otra regla activa.');
      } finally {
        this.saving.set(false);
      }
    });
  }
}
