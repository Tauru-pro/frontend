import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OnboardingSurveyService } from '../../../core/services/onboarding-survey.service';
import { TermsService } from '../../../core/services/terms.service';
import { SellerOnboardingService } from '../../../core/services/seller-onboarding.service';
import { SurveyQuestion } from '../../../core/models/onboarding-survey.model';
import { TermsDocument } from '../../../core/models/terms.model';
import {
  LocationSelectComponent,
  LocationSelection,
} from '../../../shared/components/location-select/location-select.component';

type AnswerValue = string | string[] | number | null;

@Component({
  selector: 'app-become-seller',
  imports: [LocationSelectComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'w-full' },
  template: `
    <div class="w-full max-w-2xl mx-auto py-2">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-primary">Únete como proveedor</h1>
        <p class="text-sm text-gray-500 mt-1">Completa estos pasos para empezar a vender en TAUVO</p>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        @if (errorMsg()) {
          <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-5">{{ errorMsg() }}</div>
        }

        <!-- ================= STEP 1: Company ================= -->
        @if (step() === 1) {
          <h2 class="text-base font-semibold text-primary mb-5">Datos de la empresa</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Nombre del negocio <span class="text-red-400">*</span></label>
              <input type="text" [value]="businessName()" (input)="businessName.set($any($event.target).value)"
                placeholder="Ej. Ganadería El Roble"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
              @if (stepError() && !businessName().trim()) {
                <p class="text-red-400 text-xs mt-1.5">El nombre del negocio es requerido.</p>
              }
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
              <textarea [value]="description()" (input)="description.set($any($event.target).value)" rows="3"
                placeholder="Cuéntanos sobre tu ganadería o negocio"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Teléfono de contacto</label>
              <input type="tel" [value]="contactPhone()" (input)="contactPhone.set($any($event.target).value)"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
            </div>
            <app-location-select
              [initialStateId]="selectedStateId()"
              [initialCityId]="selectedCityId()"
              [showErrors]="showLocationErrors()"
              (selectionChange)="onLocationChange($event)"
            />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label>
              <input type="text" [value]="address()" (input)="address.set($any($event.target).value)"
                class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
            </div>
          </div>
        }

        <!-- ================= STEP 2: Survey ================= -->
        @if (step() === 2) {
          <h2 class="text-base font-semibold text-primary mb-5">Cuéntanos sobre ti</h2>
          @if (loadingSurvey()) {
            <div class="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
          } @else if (questions().length === 0) {
            <p class="text-sm text-gray-500">No hay preguntas por responder. Puedes continuar.</p>
          } @else {
            <div class="space-y-6">
              @for (q of questions(); track q.id) {
                <div>
                  <label class="block text-sm font-medium text-gray-800 mb-2">
                    {{ q.prompt }} @if (q.isRequired) { <span class="text-red-400">*</span> }
                  </label>

                  @switch (q.inputType) {
                    @case ('SINGLE_CHOICE') {
                      <div class="space-y-2">
                        @for (opt of q.options; track opt) {
                          <label class="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700">
                            <input type="radio" [name]="q.id" [checked]="answers()[q.id] === opt"
                              (change)="setAnswer(q.id, opt)" class="accent-primary" />
                            {{ opt }}
                          </label>
                        }
                      </div>
                    }
                    @case ('MULTI_CHOICE') {
                      <div class="space-y-2">
                        @for (opt of q.options; track opt) {
                          <label class="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700">
                            <input type="checkbox" [checked]="isChecked(q.id, opt)"
                              (change)="toggleMulti(q.id, opt)" class="accent-primary rounded" />
                            {{ opt }}
                          </label>
                        }
                      </div>
                    }
                    @case ('NUMBER') {
                      <input type="number" [value]="$any(answers()[q.id]) ?? ''" (input)="setAnswer(q.id, toNumber($any($event.target).value))"
                        class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
                    }
                    @default {
                      <input type="text" [value]="$any(answers()[q.id]) ?? ''" (input)="setAnswer(q.id, $any($event.target).value)"
                        class="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" />
                    }
                  }

                  @if (stepError() && q.isRequired && !isAnswered(q.id)) {
                    <p class="text-red-400 text-xs mt-1.5">Esta pregunta es obligatoria.</p>
                  }
                </div>
              }
            </div>
          }
        }

        <!-- ===== Terms acceptance (part of step 2) ===== -->
        @if (step() === 2) {
          <div class="mt-6 pt-5 border-t border-gray-100">
            <label class="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" [checked]="termsAccepted()" (change)="termsAccepted.set($any($event.target).checked); stepError.set(false)"
                class="w-4 h-4 mt-0.5 rounded border-gray-300 accent-primary cursor-pointer" />
              <span class="text-sm text-gray-600">
                He leído y acepto los
                <a [routerLink]="['/terms', 'seller']" target="_blank" rel="noopener"
                  class="text-primary font-medium underline hover:text-accent transition-colors">términos y condiciones del proveedor</a>.
              </span>
            </label>
            @if (stepError() && !termsAccepted()) {
              <p class="text-red-400 text-xs mt-1.5">Debes aceptar los términos para continuar.</p>
            }
          </div>
        }

        <!-- Nav -->
        <div class="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
          <button type="button" (click)="back()" [disabled]="step() === 1 || submitting()"
            class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40">
            Atrás
          </button>
          @if (step() < 2) {
            <button type="button" (click)="next()" class="btn-primary px-6 py-2.5 text-sm">Siguiente</button>
          } @else {
            <button type="button" (click)="finish()" [disabled]="submitting()" class="btn-primary px-6 py-2.5 text-sm disabled:opacity-50">
              {{ submitting() ? 'Enviando…' : 'Finalizar y crear cuenta de proveedor' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export default class BecomeSellerComponent implements OnInit {
  private surveyService = inject(OnboardingSurveyService);
  private termsService = inject(TermsService);
  private onboardingService = inject(SellerOnboardingService);
  private router = inject(Router);

  step = signal(1);
  stepError = signal(false);
  errorMsg = signal<string | null>(null);
  submitting = signal(false);

  // Step 1 — company
  businessName = signal('');
  description = signal('');
  contactPhone = signal('');
  address = signal('');
  selectedStateId = signal<string | null>(null);
  selectedCityId = signal<string | null>(null);
  showLocationErrors = signal(false);

  // Step 2 — survey
  loadingSurvey = signal(true);
  questions = signal<SurveyQuestion[]>([]);
  answers = signal<Record<string, AnswerValue>>({});

  // Step 3 — terms
  sellerTerms = signal<TermsDocument | null>(null);
  termsAccepted = signal(false);

  requiredQuestions = computed(() => this.questions().filter((q) => q.isRequired));

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private static readonly STORAGE_KEY = 'tauvo_become_seller_v1';
  private static readonly MAX_AGE_MS = 24 * 60 * 60 * 1000;

  constructor() {
    this.restore();
    // Persiste el avance solo cuando el usuario ya pasó el primer paso.
    effect(() => {
      const snapshot = {
        step: this.step(),
        businessName: this.businessName(),
        description: this.description(),
        contactPhone: this.contactPhone(),
        address: this.address(),
        stateId: this.selectedStateId(),
        cityId: this.selectedCityId(),
        answers: this.answers(),
        termsAccepted: this.termsAccepted(),
        savedAt: Date.now(),
      };
      if (!this.isBrowser) return;
      try {
        if (snapshot.step >= 2) {
          sessionStorage.setItem(BecomeSellerComponent.STORAGE_KEY, JSON.stringify(snapshot));
        } else {
          sessionStorage.removeItem(BecomeSellerComponent.STORAGE_KEY);
        }
      } catch {
        /* almacenamiento no disponible (modo privado, etc.) */
      }
    });
  }

  private restore(): void {
    if (!this.isBrowser) return;
    try {
      const raw = sessionStorage.getItem(BecomeSellerComponent.STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        step?: number;
        businessName?: string;
        description?: string;
        contactPhone?: string;
        address?: string;
        stateId?: string | null;
        cityId?: string | null;
        answers?: Record<string, AnswerValue>;
        termsAccepted?: boolean;
        savedAt?: number;
      };
      if (!s || (s.step ?? 1) < 2) return;
      if (s.savedAt && Date.now() - s.savedAt > BecomeSellerComponent.MAX_AGE_MS) {
        sessionStorage.removeItem(BecomeSellerComponent.STORAGE_KEY);
        return;
      }
      this.step.set(s.step!);
      this.businessName.set(s.businessName ?? '');
      this.description.set(s.description ?? '');
      this.contactPhone.set(s.contactPhone ?? '');
      this.address.set(s.address ?? '');
      this.selectedStateId.set(s.stateId ?? null);
      this.selectedCityId.set(s.cityId ?? null);
      this.answers.set(s.answers ?? {});
      this.termsAccepted.set(s.termsAccepted ?? false);
    } catch {
      /* snapshot corrupto: se ignora */
    }
  }

  private clearPersisted(): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.removeItem(BecomeSellerComponent.STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const [questions, terms] = await Promise.all([
        firstValueFrom(this.surveyService.getActive()),
        firstValueFrom(this.termsService.getCurrent('SELLER')).catch(() => null),
      ]);
      this.questions.set(questions);
      this.sellerTerms.set(terms);
    } catch {
      this.errorMsg.set('No se pudo cargar la información. Intenta de nuevo.');
    } finally {
      this.loadingSurvey.set(false);
    }
  }

  onLocationChange(selection: LocationSelection | null): void {
    this.selectedStateId.set(selection?.stateId ?? null);
    this.selectedCityId.set(selection?.cityId ?? null);
  }

  toNumber(v: string): number | null {
    const n = Number(v);
    return v.trim() === '' || Number.isNaN(n) ? null : n;
  }

  setAnswer(qid: string, value: AnswerValue): void {
    this.answers.update((a) => ({ ...a, [qid]: value }));
  }

  isChecked(qid: string, opt: string): boolean {
    const v = this.answers()[qid];
    return Array.isArray(v) && v.includes(opt);
  }

  toggleMulti(qid: string, opt: string): void {
    this.answers.update((a) => {
      const cur = Array.isArray(a[qid]) ? (a[qid] as string[]) : [];
      const next = cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt];
      return { ...a, [qid]: next };
    });
  }

  isAnswered(qid: string): boolean {
    const v = this.answers()[qid];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  private surveyComplete(): boolean {
    return this.requiredQuestions().every((q) => this.isAnswered(q.id));
  }

  next(): void {
    this.stepError.set(false);
    if (this.step() === 1) {
      const missingName = !this.businessName().trim();
      const missingLocation = !this.selectedCityId();
      if (missingName || missingLocation) {
        this.stepError.set(missingName);
        this.showLocationErrors.set(missingLocation);
        return;
      }
      this.showLocationErrors.set(false);
      this.step.set(2);
    }
  }

  back(): void {
    this.stepError.set(false);
    this.errorMsg.set(null);
    if (this.step() > 1) this.step.update((s) => s - 1);
  }

  async finish(): Promise<void> {
    this.errorMsg.set(null);
    // Paso 2 valida a la vez la encuesta obligatoria y la aceptación de términos.
    if (!this.surveyComplete() || !this.termsAccepted()) {
      this.stepError.set(true);
      return;
    }
    const version = this.sellerTerms()?.version;
    if (!version) {
      this.errorMsg.set('No se pudieron cargar los términos del proveedor. Intenta de nuevo.');
      return;
    }

    this.submitting.set(true);
    try {
      const responses = this.questions()
        .filter((q) => this.isAnswered(q.id))
        .map((q) => ({ question_id: q.id, answer: this.answers()[q.id] }));

      await this.onboardingService.submit({
        company: {
          business_name: this.businessName().trim(),
          description: this.description().trim() || undefined,
          contact_phone: this.contactPhone().trim() || undefined,
          city_id: this.selectedCityId() ?? undefined,
          address: this.address().trim() || undefined,
        },
        responses,
        sellerTermsVersion: version,
      });

      // Role is now SELLER and the session was refreshed — go straight to the legal
      // documents screen so the new seller can upload (or skip) their credentials.
      this.clearPersisted();
      this.router.navigate(['/seller/legal-documents']);
    } catch (err) {
      this.errorMsg.set(
        err instanceof Error ? this.friendlyError(err.message) : 'No se pudo completar el registro. Intenta de nuevo.'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private friendlyError(code: string): string {
    switch (code) {
      case 'SURVEY_INCOMPLETE':
        return 'Faltan preguntas obligatorias por responder.';
      case 'USER_NOT_CUSTOMER':
        return 'Tu cuenta ya no es de comprador.';
      case 'INVALID_BODY':
        return 'Revisa los datos de la empresa.';
      default:
        return 'No se pudo completar el registro. Intenta de nuevo.';
    }
  }
}
