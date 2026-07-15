import { inject, Injectable } from '@angular/core';
import { SupabaseClientService } from '../auth/supabase-client';

export interface CustomerPersonalData {
  fullName: string;
  phone?: string;
  whatsapp?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerProfileService {
  private supabase = inject(SupabaseClientService).client;

  // Updates the display name on profiles and upserts the personal fields on
  // customer_profiles (no unique(user_id) there, so select-then-write).
  async save(userId: string, data: CustomerPersonalData): Promise<void> {
    const { error: pErr } = await this.supabase
      .from('profiles')
      .update({ full_name: data.fullName })
      .eq('id', userId);
    if (pErr) throw new Error(pErr.message);

    const { data: existing, error: selErr } = await this.supabase
      .from('customer_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    const row = {
      user_id: userId,
      full_name: data.fullName,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
    };

    if (existing) {
      const { error } = await this.supabase.from('customer_profiles').update(row).eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await this.supabase.from('customer_profiles').insert(row);
      if (error) throw new Error(error.message);
    }
  }
}
