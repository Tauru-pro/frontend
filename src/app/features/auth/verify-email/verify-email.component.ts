import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'w-full'
  },
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

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="px-8 py-8">

          <!-- Icon -->
          <div class="flex justify-center mb-5">
            <div class="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center">
              <svg class="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <h1 class="text-xl font-bold text-primary text-center mb-1">Verify your email</h1>
          <p class="text-sm text-gray-400 text-center mb-6 leading-relaxed">
            We sent a 6-digit code to<br />
            <span class="font-medium text-gray-600">{{ email() ?? 'your email address' }}</span>
          </p>

          <!-- Error -->
          @if (errorMessage()) {
            <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
              {{ errorMessage() }}
            </div>
          }

          <!-- Success (resend) -->
          @if (resendSuccess()) {
            <div class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-4 flex items-center gap-2">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Code resent! Check your inbox.
            </div>
          }

          <!-- Code input -->
          <form (submit)="onVerify(); $event.preventDefault()">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Verification code <span class="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputmode="numeric"
                maxlength="6"
                [value]="code()"
                (input)="onCodeInput($event)"
                placeholder="Enter 6-digit code"
                class="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all tracking-[0.3em] font-mono text-center text-base"
              />
            </div>

            <button
              type="submit"
              [disabled]="loading() || code().length < 6"
              class="w-full bg-primary hover:bg-primary-dark  text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (loading()) {
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Verifying...
                </span>
              } @else {
                Verify Email
              }
            </button>
          </form>

          <!-- Resend -->
          <div class="mt-5 text-center">
            <p class="text-sm text-gray-400">
              Didn't receive the code?
              <button
                type="button"
                (click)="onResend()"
                [disabled]="resendLoading()"
                class="text-accent hover:text-accent-dark font-medium transition-colors hover:underline ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (resendLoading()) { Sending... } @else { Resend code }
              </button>
            </p>
          </div>

        </div>
      </div>

      <p class="text-center text-sm text-gray-400 mt-6">
        Wrong email?
        <a routerLink="/auth/sign-up" class="text-primary font-semibold hover:text-accent transition-colors ml-1">
          Go back to sign up
        </a>
      </p>
    </div>
  `,
})
export default class VerifyEmailComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = this.authService.pendingEmail;
  code = signal('');
  loading = signal(false);
  resendLoading = signal(false);
  errorMessage = signal<string | null>(null);
  resendSuccess = signal(false);

  onCodeInput(event: Event) {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    this.code.set(value);
    (event.target as HTMLInputElement).value = value;
  }

  async onVerify() {
    if (this.code().length < 6 || this.loading()) return;
    if (!this.email()) {
      this.router.navigate(['/auth/sign-up']);
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.authService.verifyEmail(this.code());
      this.router.navigate(['/auth/sign-in']);
    } catch (err) {
      this.errorMessage.set(this.authService.getErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onResend() {
    if (this.resendLoading()) return;
    this.resendLoading.set(true);
    this.resendSuccess.set(false);
    this.errorMessage.set(null);
    try {
      await this.authService.resendCode();
      this.resendSuccess.set(true);
    } catch (err) {
      this.errorMessage.set(this.authService.getErrorMessage(err));
    } finally {
      this.resendLoading.set(false);
    }
  }
}

