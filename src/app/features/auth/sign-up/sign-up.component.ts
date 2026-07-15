import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { form, FormField, submit, required, email, minLength, validate } from "@angular/forms/signals";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../../../core/auth/auth.service";
import { TermsService } from "../../../core/services/terms.service";
import { TermsDocument } from "../../../core/models/terms.model";

@Component({
  selector: 'app-sign-up',
  imports: [RouterLink, RouterLinkActive, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'w-full'
  },
  template: `
    <div class="w-full max-w-md block mx-auto">
      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">

        <!-- Tabs -->
        <div class="flex border-b border-gray-100">
          <a
            routerLink="/auth/sign-in"
            routerLinkActive="border-b-2 border-primary text-primary font-semibold"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex-1 py-4 text-center text-sm font-medium text-gray-400 hover:text-primary transition-colors uppercase tracking-widest"
          >
            Iniciar sesión
          </a>
          <a
            routerLink="/auth/sign-up"
            routerLinkActive="border-b-2 border-primary text-primary font-semibold"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex-1 py-4 text-center text-sm font-medium text-gray-400 hover:text-primary transition-colors uppercase tracking-widest"
          >
            Registrarse
          </a>
        </div>

        <!-- Form body -->
        <div class="px-8 py-7">
          <form (submit)="onSubmit(); $event.preventDefault()">

            <!-- Error -->
            @if (errorMessage()) {
              <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                {{ errorMessage() }}
              </div>
            }

            <!-- Full name -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre completo <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                [formField]="signUpForm.fullName"
                placeholder="Juan Pérez"
                class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (signUpForm.fullName().touched() && signUpForm.fullName().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ signUpForm.fullName().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Email -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico <span class="text-red-400">*</span>
              </label>
              <input
                type="email"
                [formField]="signUpForm.email"
                placeholder="you@example.com"
                class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
              @if (signUpForm.email().touched() && signUpForm.email().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ signUpForm.email().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Password -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  [formField]="signUpForm.password"
                  placeholder="Mínimo 8 caracteres"
                  class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  tabindex="-1"
                >
                  @if (showPassword()) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  }
                </button>
              </div>
              @if (signUpForm.password().touched() && signUpForm.password().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ signUpForm.password().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Confirm Password -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Confirmar contraseña <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <input
                  [type]="showConfirmPassword() ? 'text' : 'password'"
                  [formField]="signUpForm.confirmPassword"
                  placeholder="Repite tu contraseña"
                  class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  (click)="showConfirmPassword.set(!showConfirmPassword())"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  tabindex="-1"
                >
                  @if (showConfirmPassword()) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  }
                </button>
              </div>
              @if (signUpForm.confirmPassword().touched() && signUpForm.confirmPassword().errors().length) {
                <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ signUpForm.confirmPassword().errors()[0].message }}
                </p>
              }
            </div>

            <!-- Submit -->
            <button
              type="submit"
              [disabled]="signUpForm().pending()"
              class="w-full btn-primary py-3 text-sm tracking-wide shadow-sm hover:shadow-md"
            >
              @if (signUpForm().pending()) {
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Creando cuenta...
                </span>
              } @else {
                Crear cuenta
              }
            </button>

            <!-- Buyer terms acceptance -->
            <div class="mt-4">
              <label class="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  [checked]="acceptedTerms()"
                  (change)="acceptedTerms.set($any($event.target).checked); termsError.set(false)"
                  class="w-4 h-4 mt-0.5 rounded border-gray-300 accent-primary cursor-pointer"
                />
                <span class="text-xs text-gray-500 leading-relaxed">
                  He leído y acepto los
                  <button type="button" (click)="showTerms.set(true)" class="text-primary hover:text-accent font-medium underline">
                    Términos y Condiciones del comprador
                  </button>
                </span>
              </label>
              @if (termsError()) {
                <p class="text-red-400 text-xs mt-1.5">Debes aceptar los términos y condiciones para continuar.</p>
              }
            </div>
          </form>

          <!-- Divider -->
          <div class="flex items-center gap-3 my-6">
            <hr class="flex-1 border-gray-100" />
            <span class="text-[11px] text-gray-300 font-medium uppercase tracking-widest whitespace-nowrap">O regístrate con</span>
            <hr class="flex-1 border-gray-100" />
          </div>

          <!-- Social login -->
          <div class="flex gap-3">
            <button
              type="button"
              (click)="onGoogleSignIn()"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>
        </div>
      </div>

      <!-- Login link -->
      <p class="text-center text-sm text-gray-400 mt-6">
        ¿Ya tienes una cuenta?
        <a routerLink="/auth/sign-in" class="text-primary font-semibold hover:text-accent transition-colors ml-1">
          Inicia sesión aquí
        </a>
      </p>
    </div>

    @if (showTerms()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="showTerms.set(false)">
        <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" (click)="$event.stopPropagation()">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-semibold text-primary">Términos y Condiciones del comprador</h3>
            <button type="button" (click)="showTerms.set(false)" class="text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="px-6 py-4 overflow-y-auto text-sm text-gray-600 whitespace-pre-line">{{ buyerTerms()?.content ?? 'Cargando…' }}</div>
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button type="button" (click)="acceptedTerms.set(true); termsError.set(false); showTerms.set(false)" class="btn-primary px-5 py-2 text-sm">
              Aceptar
            </button>
          </div>
        </div>
      </div>
    }
    `,
})
export default class SignUpComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private termsService = inject(TermsService);

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  errorMessage = signal<string | null>(null);
  acceptedTerms = signal(false);
  termsError = signal(false);
  showTerms = signal(false);
  buyerTerms = signal<TermsDocument | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.buyerTerms.set(await firstValueFrom(this.termsService.getCurrent('BUYER')));
    } catch {
      // Non-blocking: the acceptance checkbox still gates submission.
    }
  }

  model = signal({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  signUpForm = form(this.model, (s) => {
    required(s.fullName, { message: 'El nombre completo es requerido' });
    minLength(s.fullName, 2, { message: 'El nombre debe tener al menos 2 caracteres' });
    required(s.email, { message: 'El correo es requerido' });
    email(s.email, { message: 'Ingresa un correo electrónico válido' });
    required(s.password, { message: 'La contraseña es requerida' });
    minLength(s.password, 8, { message: 'La contraseña debe tener al menos 8 caracteres' });
    required(s.confirmPassword, { message: 'Confirma tu contraseña' });
    validate(s.confirmPassword, ({ value, valueOf }) => {
      if (value() !== valueOf(s.password)) {
        return { kind: 'mismatch', message: 'Las contraseñas no coinciden' };
      }
      return undefined;
    });
  });

  onGoogleSignIn(): void {
    this.authService.signInWithGoogle();
  }

  onSubmit() {
    this.errorMessage.set(null);
    if (!this.acceptedTerms()) {
      this.termsError.set(true);
      return;
    }
    submit(this.signUpForm, async () => {
      try {
        const { fullName, email, password } = this.model();
        await this.authService.register(fullName, email, password, this.buyerTerms()?.version);
        this.router.navigate(['/auth/verify-email']);
      } catch (err) {
        this.errorMessage.set(this.authService.getErrorMessage(err));
      }
    });
  }
}

