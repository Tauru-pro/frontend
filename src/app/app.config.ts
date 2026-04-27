import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { Amplify } from 'aws-amplify';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { cognitoConfig } from './core/config/cognito.config';
import { isPlatformBrowser } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideAppInitializer(() => {
      if (isPlatformBrowser(inject(PLATFORM_ID))) {
        Amplify.configure({
          Auth: {
            Cognito: {
              userPoolId: cognitoConfig.userPoolId,
              userPoolClientId: cognitoConfig.userPoolClientId,
            },
          },
        });
      }
    }),
  ],
};
