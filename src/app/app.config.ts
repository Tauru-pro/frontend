import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { Amplify } from 'aws-amplify';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { cognitoConfig } from './core/config/cognito.config';
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
        Amplify.configure({
          Auth: {
            Cognito: {
              userPoolId: cognitoConfig.userPoolId,
              userPoolClientId: cognitoConfig.userPoolClientId,
              loginWith: {
                oauth: {
                  domain: cognitoConfig.oauth.domain,
                  scopes: ['email', 'openid', 'profile'],
                  redirectSignIn: [cognitoConfig.oauth.redirectSignIn],
                  redirectSignOut: [cognitoConfig.oauth.redirectSignOut],
                  responseType: 'code',
                },
              },
            },
          },
        });

        // Both injections must happen here (sync), before the async boundary.
        const authService = inject(AuthService);
        const userStore = inject(UserStore);

        // Return the Promise so Angular blocks the router until both
        // the Cognito session check and /auth/me have resolved, preventing
        // the race condition where guards read userStore.user() before it's populated.
        return authService.loadCurrentUser().then(user => {
          if (user) return userStore.loadUser();
          return;
        });
      }
      return;
    }),
  ],
};
