import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { SupabaseClientService } from '../auth/supabase-client';

// Auth/user calls go directly through supabase-js now; this interceptor only
// matters for domains still served by the legacy backend (bulls, supplies,
// branches, etc.) that expect an Authorization: Bearer header.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return next(req);

  const supabase = inject(SupabaseClientService).client;
  return from(supabase.auth.getSession()).pipe(
    switchMap(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return next(req);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    })
  );
};
