import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  // Session persistence/URL detection only make sense in the browser —
  // there is no Cognito-equivalent session on the server either, so SSR
  // keeps treating every request as unauthenticated (see guards).
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly client: SupabaseClient = createClient(environment.supabase.url, environment.supabase.anonKey, {
    auth: {
      persistSession: this.isBrowser,
      detectSessionInUrl: this.isBrowser,
      autoRefreshToken: this.isBrowser,
    },
  });
}
