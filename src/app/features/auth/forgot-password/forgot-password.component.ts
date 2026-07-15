import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField, submit, required, email } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
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

          @if (sent()) {
            <div class="text-center">
              <div class="w-14 h-14 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-7 h-7 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 class="text-lg font-semibold text-primary mb-2">Revisa tu correo</h1>
              <p class="text-sm text-gray-500 leading-relaxed mb-6">
                Si hay una cuenta con <span class="font-medium text-gray-700">{{ model().email }}</span>,
                te enviamos un enlace para crear una contraseña nueva. El enlace vence en 1 hora.
              </p>
              <p class="text-xs text-gray-400 leading-relaxed mb-6">
                ¿No lo ves? Revisa la carpeta de spam o correo no deseado.
              </p>
              <button type="button" (click)="reset()"
                class="w-full btn-primary-outline py-2.5 text-sm mb-3">
                Intentar con otro correo
              </button>
              <a routerLink="/auth/sign-in" class="block text-sm text-accent hover:text-accent-dark font-medium transition-colors hover:underline">
                Volver a iniciar sesión
              </a>
            </div>
          } @else {
            <h1 class="text-lg font-semibold text-primary mb-1">¿Olvidaste tu contraseña?</h1>
            <p class="text-sm text-gray-500 mb-6 leading-relaxed">
              No pasa nada. Escribe tu correo y te enviamos un enlace para crear una nueva.
            </p>

            <form (submit)="onSubmit(); $event.preventDefault()">
              @if (errorMessage()) {
                <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                  {{ errorMessage() }}
                </div>
              }

              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Correo electrónico <span class="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  [formField]="forgotForm.email"
                  placeholder="tucorreo@ejemplo.com"
                  class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (forgotForm.email().touched() && forgotForm.email().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5">{{ forgotForm.email().errors()[0].message }}</p>
                }
              </div>

              <button
                type="submit"
                [disabled]="forgotForm().pending() || sending()"
                class="w-full btn-primary py-3 text-sm tracking-wide shadow-sm hover:shadow-md"
              >
                @if (sending()) {
                  <span class="flex items-center justify-center gap-2">
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Enviando...
                  </span>
                } @else {
                  Enviar enlace
                }
              </button>
            </form>
          }
        </div>
      </div>

      <p class="text-center text-sm text-gray-400 mt-6">
        ¿Recordaste tu contraseña?
        <a routerLink="/auth/sign-in" class="text-primary font-semibold hover:text-accent transition-colors ml-1">
          Inicia sesión
        </a>
      </p>
    </div>
  `,
})
export default class ForgotPasswordComponent {
  private authService = inject(AuthService);

  sending = signal(false);
  sent = signal(false);
  errorMessage = signal<string | null>(null);

  model = signal({ email: '' });
  forgotForm = form(this.model, (s) => {
    required(s.email, { message: 'El correo es requerido' });
    email(s.email, { message: 'Ingresa un correo electrónico válido' });
  });

  onSubmit(): void {
    this.errorMessage.set(null);
    submit(this.forgotForm, async () => {
      this.sending.set(true);
      try {
        await this.authService.requestPasswordReset(this.model().email.trim());
        // Always the same outcome, account or not: branching here would leak
        // which emails are registered.
        this.sent.set(true);
      } catch (err) {
        this.errorMessage.set(this.authService.getErrorMessage(err));
      } finally {
        this.sending.set(false);
      }
    });
  }

  reset(): void {
    this.sent.set(false);
    this.model.set({ email: '' });
  }
}
