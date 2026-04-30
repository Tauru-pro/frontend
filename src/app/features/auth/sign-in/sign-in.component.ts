import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { form, FormField, submit, required, email, minLength, validate } from "@angular/forms/signals";
import { AuthService } from "../../../core/auth/auth.service";
import { UserStore } from "../../../core/store/user.store";

type SignInStep = 'credentials' | 'new_password' | 'mfa';

@Component({
  selector: 'app-sign-in',
  imports: [RouterLink, RouterLinkActive, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'w-full' },
  template: `
    <div class="w-full max-w-md block mx-auto">
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">

        <!-- Tabs (credentials step only) -->
        @if (signInStep() === 'credentials') {
          <div class="flex border-b border-gray-100">
            <a
              routerLink="/auth/sign-in"
              routerLinkActive="border-b-2 border-primary text-primary font-semibold"
              [routerLinkActiveOptions]="{ exact: true }"
              class="flex-1 py-4 text-center text-sm font-medium text-gray-400 hover:text-primary transition-colors uppercase tracking-widest"
            >Login</a>
            <a
              routerLink="/auth/sign-up"
              routerLinkActive="border-b-2 border-primary text-primary font-semibold"
              [routerLinkActiveOptions]="{ exact: true }"
              class="flex-1 py-4 text-center text-sm font-medium text-gray-400 hover:text-primary transition-colors uppercase tracking-widest"
            >Register</a>
          </div>
        } @else {
          <!-- Step header with back button -->
          <div class="flex items-center gap-3 px-8 pt-6 pb-2 border-b border-gray-100">
            <button
              type="button"
              (click)="backToCredentials()"
              class="text-gray-400 hover:text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="text-sm font-semibold text-primary uppercase tracking-widest">
              {{ signInStep() === 'new_password' ? 'Set New Password' : 'Verify Your Identity' }}
            </h2>
          </div>
        }

        <div class="px-8 py-7">

          <!-- ── CREDENTIALS STEP ── -->
          @if (signInStep() === 'credentials') {
            <form (submit)="onSubmit(); $event.preventDefault()">
              @if (errorMessage()) {
                <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                  {{ errorMessage() }}
                </div>
              }

              <!-- Email -->
              <div class="mb-5">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address <span class="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  [formField]="signInForm.email"
                  placeholder="you@example.com"
                  class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
                @if (signInForm.email().touched() && signInForm.email().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ signInForm.email().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Password -->
              <div class="mb-5">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Password <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    [type]="showPassword() ? 'text' : 'password'"
                    [formField]="signInForm.password"
                    placeholder="••••••••"
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
                @if (signInForm.password().touched() && signInForm.password().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ signInForm.password().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Remember me -->
              <div class="mb-6">
                <label class="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" [formField]="signInForm.rememberMe"
                    class="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" />
                  <span class="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">Remember me</span>
                </label>
              </div>

              <!-- Submit -->
              <button
                type="submit"
                [disabled]="signInForm().pending()"
                class="w-full btn-primary py-3 text-sm tracking-wide shadow-sm hover:shadow-md"
              >
                @if (signInForm().pending()) {
                  <span class="flex items-center justify-center gap-2">
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Logging in...
                  </span>
                } @else {
                  Log In
                }
              </button>

              <div class="mt-4 text-center">
                <a href="#" class="text-sm text-accent hover:text-accent-dark font-medium transition-colors hover:underline">
                  Lost your password?
                </a>
              </div>
            </form>

            <!-- Divider -->
            <div class="flex items-center gap-3 my-6">
              <hr class="flex-1 border-gray-100" />
              <span class="text-[11px] text-gray-300 font-medium uppercase tracking-widest whitespace-nowrap">Or login with</span>
              <hr class="flex-1 border-gray-100" />
            </div>

            <!-- Social login -->
            <div class="flex gap-3">
              <button type="button" (click)="onGoogleSignIn()"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
                <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button type="button"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1877F2] hover:bg-[#1565C0] text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md">
                <svg class="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
            </div>
          }

          <!-- ── NEW PASSWORD STEP ── -->
          @if (signInStep() === 'new_password') {
            <p class="text-sm text-gray-500 mb-6">
              Your account requires a new password before continuing.
            </p>
            <form (submit)="onSubmitNewPassword(); $event.preventDefault()">
              @if (errorMessage()) {
                <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                  {{ errorMessage() }}
                </div>
              }

              <!-- New password -->
              <div class="mb-5">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    [type]="showNewPassword() ? 'text' : 'password'"
                    [formField]="newPasswordForm.newPassword"
                    placeholder="••••••••"
                    class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  <button type="button" (click)="showNewPassword.set(!showNewPassword())"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors" tabindex="-1">
                    @if (showNewPassword()) {
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
                @if (newPasswordForm.newPassword().touched() && newPasswordForm.newPassword().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ newPasswordForm.newPassword().errors()[0].message }}
                  </p>
                }
              </div>

              <!-- Confirm new password -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    [type]="showConfirmPassword() ? 'text' : 'password'"
                    [formField]="newPasswordForm.confirmPassword"
                    placeholder="••••••••"
                    class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                  <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors" tabindex="-1">
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
                @if (newPasswordForm.confirmPassword().touched() && newPasswordForm.confirmPassword().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ newPasswordForm.confirmPassword().errors()[0].message }}
                  </p>
                }
              </div>

              <button
                type="submit"
                [disabled]="newPasswordForm().pending()"
                class="w-full btn-primary py-3 text-sm tracking-wide shadow-sm hover:shadow-md"
              >
                @if (newPasswordForm().pending()) {
                  <span class="flex items-center justify-center gap-2">
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Saving...
                  </span>
                } @else {
                  Set New Password
                }
              </button>
            </form>
          }

          <!-- ── MFA STEP ── -->
          @if (signInStep() === 'mfa') {
            <p class="text-sm text-gray-500 mb-6">
              @if (challengeDelivery()) {
                A verification code was sent to your <strong>{{ challengeDelivery() }}</strong>. Enter it below.
              } @else {
                Enter the 6-digit code from your authenticator app.
              }
            </p>
            <form (submit)="onSubmitMfa(); $event.preventDefault()">
              @if (errorMessage()) {
                <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                  {{ errorMessage() }}
                </div>
              }

              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification Code <span class="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  inputmode="numeric"
                  [formField]="mfaForm.code"
                  placeholder="000000"
                  class="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-center tracking-[0.5em] font-mono"
                />
                @if (mfaForm.code().touched() && mfaForm.code().errors().length) {
                  <p class="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {{ mfaForm.code().errors()[0].message }}
                  </p>
                }
              </div>

              <button
                type="submit"
                [disabled]="mfaForm().pending()"
                class="w-full btn-primary py-3 text-sm tracking-wide shadow-sm hover:shadow-md"
              >
                @if (mfaForm().pending()) {
                  <span class="flex items-center justify-center gap-2">
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Verifying...
                  </span>
                } @else {
                  Verify
                }
              </button>
            </form>
          }

        </div>
      </div>

      @if (signInStep() === 'credentials') {
        <p class="text-center text-sm text-gray-400 mt-6">
          Don't have an account?
          <a routerLink="/auth/sign-up" class="text-primary font-semibold hover:text-accent transition-colors ml-1">
            Register here
          </a>
        </p>
      }
    </div>
  `,
})
export default class SignInComponent {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private userStore   = inject(UserStore);

  signInStep = signal<SignInStep>('credentials');
  showPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  errorMessage = signal<string | null>(null);
  challengeDelivery = signal<string | null>(null);

  // ── Credentials form ──
  model = signal({ email: '', password: '', rememberMe: false });
  signInForm = form(this.model, (s) => {
    required(s.email, { message: 'Email is required' });
    email(s.email, { message: 'Please enter a valid email address' });
    required(s.password, { message: 'Password is required' });
    minLength(s.password, 6, { message: 'Password must be at least 6 characters' });
  });

  // ── New password form ──
  newPasswordModel = signal({ newPassword: '', confirmPassword: '' });
  newPasswordForm = form(this.newPasswordModel, (s) => {
    required(s.newPassword, { message: 'Password is required' });
    minLength(s.newPassword, 8, { message: 'Password must be at least 8 characters' });
    required(s.confirmPassword, { message: 'Please confirm your password' });
    validate(s.confirmPassword, ({ value, valueOf }) => {
      if (value() !== valueOf(s.newPassword)) {
        return { kind: 'mismatch', message: 'Passwords do not match' };
      }
      return undefined;
    });
  });

  // ── MFA form ──
  mfaModel = signal({ code: '' });
  mfaForm = form(this.mfaModel, (s) => {
    required(s.code, { message: 'Code is required' });
    minLength(s.code, 6, { message: 'Enter the 6-digit code' });
  });

  backToCredentials(): void {
    this.signInStep.set('credentials');
    this.errorMessage.set(null);
  }

  onGoogleSignIn(): void {
    this.authService.signInWithGoogle();
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    submit(this.signInForm, async () => {
      try {
        const { email, password } = this.model();
        const result = await this.authService.login(email, password);

        switch (result.nextStep.signInStep) {
          case 'CONFIRM_SIGN_UP':
            this.authService.pendingEmail.set(email);
            this.router.navigate(['/auth/verify-email']);
            break;
          case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
            this.signInStep.set('new_password');
            break;
          case 'CONFIRM_SIGN_IN_WITH_SMS_CODE':
            this.challengeDelivery.set(
              (result.nextStep as { codeDeliveryDetails?: { deliveryMedium?: string } })
                .codeDeliveryDetails?.deliveryMedium ?? 'phone'
            );
            this.signInStep.set('mfa');
            break;
          case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
            this.signInStep.set('mfa');
            break;
          default:
            if (result.isSignedIn) this.navigateByRole();
        }
      } catch (err) {
        this.errorMessage.set(this.authService.getErrorMessage(err));
      }
    });
  }

  onSubmitNewPassword(): void {
    this.errorMessage.set(null);
    submit(this.newPasswordForm, async () => {
      try {
        const { newPassword } = this.newPasswordModel();
        const result = await this.authService.confirmSignInChallenge(newPassword);
        if (result.isSignedIn) this.navigateByRole();
      } catch (err) {
        this.errorMessage.set(this.authService.getErrorMessage(err));
      }
    });
  }

  private navigateByRole(): void {
    const role = this.userStore.user()?.role;
    if (role === 'ADMIN')       this.router.navigate(['/admin']);
    else if (role === 'SELLER') this.router.navigate(['/seller/products']);
    else                        this.router.navigate(['/']);
  }

  onSubmitMfa(): void {
    this.errorMessage.set(null);
    submit(this.mfaForm, async () => {
      try {
        const { code } = this.mfaModel();
        const result = await this.authService.confirmSignInChallenge(code);
        if (result.isSignedIn) this.navigateByRole();
      } catch (err) {
        this.errorMessage.set(this.authService.getErrorMessage(err));
      }
    });
  }
}
