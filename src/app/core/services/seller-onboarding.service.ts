import { inject, Injectable } from '@angular/core';
import { SupabaseClientService } from '../auth/supabase-client';
import { AuthService } from '../auth/auth.service';
import { UserStore } from '../store/user.store';
import { SurveyAnswer } from '../models/onboarding-survey.model';

export interface SellerCompanyData {
  business_name: string;
  description?: string;
  contact_phone?: string;
  address?: string;
  city_id?: string;
}

export interface SellerOnboardingPayload {
  company: SellerCompanyData;
  responses: SurveyAnswer[];
  sellerTermsVersion: string;
}

@Injectable({ providedIn: 'root' })
export class SellerOnboardingService {
  private supabase = inject(SupabaseClientService).client;
  private auth = inject(AuthService);
  private userStore = inject(UserStore);

  /**
   * Submits the onboarding, which promotes the caller CUSTOMER -> SELLER via
   * the seller-self-onboard Edge Function, then refreshes the session so the
   * new role/tenant claims take effect and reloads the user profile.
   */
  async submit(payload: SellerOnboardingPayload): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('seller-self-onboard', {
      body: payload,
    });

    if (error) {
      // FunctionsHttpError carries the Response; surface the server error code.
      let message = error.message;
      try {
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        /* ignore parse failures */
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);

    await this.auth.refreshSession();
    await this.userStore.loadUser();
  }
}
