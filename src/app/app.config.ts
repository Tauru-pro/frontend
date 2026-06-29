import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { UserStore } from './core/store/user.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      if (isPlatformBrowser(inject(PLATFORM_ID))) {
        // Both injections must happen here (sync), before the async boundary.
        // Injecting AuthService also constructs the Supabase client (see
        // core/auth/supabase-client.ts).
        const authService = inject(AuthService);
        const userStore = inject(UserStore);

        // Return the Promise so Angular blocks the router until both
        // the Supabase session check and the profile load have resolved,
        // preventing the race condition where guards read userStore.user()
        // before it's populated.
        return authService.loadCurrentUser().then(user => {
          if (user) return userStore.loadUser();
          return;
        });
      }
      return;
    }),
  ],
};
