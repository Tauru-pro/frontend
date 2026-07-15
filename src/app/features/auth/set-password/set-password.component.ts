import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, submit, required, minLength, validate } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';
import { navigateByRole } from '../../../core/auth/navigate-by-role';
import { UserStore } from '../../../core/store/user.store';

@Component({
  selector: 'app-set-password',
  imports: [RouterLink, FormField],
  host: { class: 'w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-md block mx-auto">

      <!-- Logo -->
      <div class="flex justify-center mb-8">
        <a routerLink="/" class="flex items-center gap-2.5">
          <div class="w-10 h-10 bg-accent rounded-lg flex items-center justify-center font-bold text-white text-xl">T</div>
          <div class="leading-none">
            <div class="flex items-baseline gap-0.5">
              <span class="text-2xl font-bold text-primary">Tauru</span>
              <span class="text-accent font-bold text-2xl">.</span>
            </div>
            <div class="text-[10px] text-gray-400 tracking-widest uppercase">Market</div>
          </div>
        </a>
      </div>

      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-8 py-7">

          @if (checkingSession()) {
            <div class="flex justify-center py-8">
              <svg class="animate-spin w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          } @else if (!sessionValid()) {
            <div class="text-center">
              <h2 class="text-lg font-semibold text-gray-800 mb-2">Link inválido o vencido</h2>
              <p class="text-sm text-gray-500 mb-6">{{ expiredHelp() }}</p>
              @if (isRecovery()) {
                <a routerLink="/auth/forgot-password" class="inline-block btn-primary px-6 py-2.5 text-sm">
                  Pedir un enlace nuevo
                </a>
              } @else {
                <a routerLink="/auth/sign-in" class="inline-block btn-primary px-6 py-2.5 text-sm">
                  Volver a iniciar sesión
                </a>
              }
            </div>
          } @else {
            <h1 class="text-lg font-semibold text-primary mb-1">{{ title() }}</h1>
            <p class="text-sm text-gray-500 mb-6">{{ subtitle() }}</p>

            <form (submit)="onSubmit(); $event.preventDefault()">
              @if (errorMessage()) {
                <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                  {{ errorMessage() }}
                </div>
              }

              <!-- Password -->
              <div class="mb-5">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    [type]="showPassword() ? 'text' : 'password'"
                    [formField]="setPasswordForm.password"
                    placeholder="Mínimo 8 caracteres"
                    class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  <button type="button" (click)="showPassword.set(!showPassword())"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors" tabindex="-1">
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
                @if (setPasswordForm.password().touched() && setPasswordForm.password().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5">{{ setPasswordForm.password().errors()[0].message }}</p>
                }
              </div>

              <!-- Confirm password -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar contraseña <span class="text-red-400">*</span>
                </label>
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  [formField]="setPasswordForm.confirmPassword"
                  placeholder="Repite tu contraseña"
                  class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (setPasswordForm.confirmPassword().touched() && setPasswordForm.confirmPassword().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5">{{ setPasswordForm.confirmPassword().errors()[0].message }}</p>
                }
              </div>

              <button
                type="submit"
                [disabled]="setPasswordForm().pending() || saving()"
                class="w-full btn-primary py-3 text-sm tracking-wide shadow-sm hover:shadow-md"
              >
                @if (saving()) {
                  <span class="flex items-center justify-center gap-2">
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Guardando...
                  </span>
                } @else {
                  Guardar contraseña
                }
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
})
export default class SetPasswordComponent implements OnInit {
  private authService = inject(AuthService);
  private userStore = inject(UserStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  checkingSession = signal(true);
  sessionValid = signal(false);
  showPassword = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  // Same screen, two entry points: an admin invite (no password yet) and the
  // recovery email (?flow=recovery). Only the wording differs — telling someone
  // who forgot their password to "ask whoever invited you" makes no sense.
  private isRecoveryFlow = signal(false);
  isRecovery = computed(() => this.isRecoveryFlow());
  title = computed(() => (this.isRecoveryFlow() ? 'Restablece tu contraseña' : 'Crea tu contraseña'));
  subtitle = computed(() =>
    this.isRecoveryFlow()
      ? 'Elige una contraseña nueva para tu cuenta.'
      : 'Define una contraseña para tu cuenta.'
  );
  expiredHelp = computed(() =>
    this.isRecoveryFlow()
      ? 'Este enlace ya venció o se usó. Pide uno nuevo para continuar.'
      : 'Este enlace ya no es válido. Pide a quien te invitó que reenvíe la invitación.'
  );

  model = signal({ password: '', confirmPassword: '' });
  setPasswordForm = form(this.model, (s) => {
    required(s.password, { message: 'La contraseña es requerida' });
    minLength(s.password, 8, { message: 'Debe tener al menos 8 caracteres' });
    required(s.confirmPassword, { message: 'Confirma tu contraseña' });
    validate(s.confirmPassword, ({ value, valueOf }) => {
      if (value() !== valueOf(s.password)) {
        return { kind: 'mismatch', message: 'Las contraseñas no coinciden' };
      }
      return undefined;
    });
  });

  async ngOnInit(): Promise<void> {
    this.isRecoveryFlow.set(this.route.snapshot.queryParamMap.get('flow') === 'recovery');
    if (!isPlatformBrowser(this.platformId)) return;
    const user = await this.authService.loadCurrentUser();
    this.sessionValid.set(!!user);
    this.checkingSession.set(false);
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    submit(this.setPasswordForm, async () => {
      this.saving.set(true);
      try {
        const { password } = this.model();
        await this.authService.setPassword(password);
        await this.userStore.loadUser();
        navigateByRole(this.router, this.userStore.user()?.role);
      } catch (err) {
        this.errorMessage.set(this.authService.getErrorMessage(err));
      } finally {
        this.saving.set(false);
      }
    });
  }
}
