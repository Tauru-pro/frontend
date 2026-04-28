import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { UserStore } from '../../../core/store/user.store';

@Component({
  selector: 'app-callback',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center">
      @if (loading()) {
        <div class="text-center">
          <div class="w-16 h-16 bg-[#C8812A] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span class="text-2xl font-bold text-white">T</span>
          </div>
          <svg class="animate-spin w-8 h-8 text-[#C8812A] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p class="text-gray-500 text-sm">Completing sign in...</p>
        </div>
      } @else {
        <div class="text-center max-w-sm mx-auto px-4">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-800 mb-2">Authentication failed</h2>
          <p class="text-sm text-gray-500 mb-6">{{ error() }}</p>
          <a
            routerLink="/auth/sign-in"
            class="inline-block bg-[#0B1D2E] text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-[#162a3d] transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      }
    </div>
  `,
})
export default class CallbackComponent implements OnInit, OnDestroy {
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private userStore  = inject(UserStore);

  loading = signal(true);
  error = signal<string | null>(null);

  private unsubscribeHub?: () => void;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.unsubscribeHub = Hub.listen('auth', async ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        await this.navigateByRole();
      } else if (payload.event === 'signInWithRedirect_failure') {
        this.loading.set(false);
        this.error.set('Sign in with Google failed. Please try again.');
      }
    });

    // Amplify may have already processed the code before this component mounted
    getCurrentUser()
      .then(() => this.navigateByRole())
      .catch(() => { /* Hub listener will handle the pending code exchange */ });
  }

  ngOnDestroy() {
    this.unsubscribeHub?.();
  }

  private async navigateByRole(): Promise<void> {
    if (!this.userStore.user()) await this.userStore.loadUser();
    const role = this.userStore.user()?.role;
    if (role === 'ADMIN')       this.router.navigate(['/admin']);
    else if (role === 'SELLER') this.router.navigate(['/seller/products']);
    else                        this.router.navigate(['/']);
  }
}
