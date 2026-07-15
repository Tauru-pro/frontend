import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { SellerProfile, UserProfile } from '../models/user.model';
import { SupabaseClientService } from '../auth/supabase-client';
import {
  mapSellerProfileRow,
  SELLER_CITY_EMBED,
  SellerProfileRow,
} from '../services/seller.service';

interface UserState {
  user: UserProfile | null;
  sellerProfile: SellerProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = { user: null, sellerProfile: null, loading: false, error: null };

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserProfile['role'];
  status: UserProfile['status'];
  created_at: string;
  seller_profiles: SellerProfileRow[] | null;
  customer_profiles: CustomerProfileRow[] | null;
}

interface CustomerProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  herd_size: string | null;
  buyer_type: string | null;
  whatsapp: string | null;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  const sellerRow = row.seller_profiles?.[0];
  const customerRow = row.customer_profiles?.[0];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? undefined,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    sellerProfile: sellerRow ? mapSellerProfileRow(sellerRow) : undefined,
    customerProfile: customerRow
      ? {
          id: customerRow.id,
          userId: customerRow.user_id,
          fullName: customerRow.full_name ?? '',
          phone: customerRow.phone ?? undefined,
          herdSize: customerRow.herd_size ?? undefined,
          buyerType: customerRow.buyer_type ?? undefined,
          whatsapp: customerRow.whatsapp ?? undefined,
        }
      : undefined,
  };
}

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState<UserState>(initialState),
  withMethods((store) => {
    const supabase = inject(SupabaseClientService).client;
    return {
      async loadUser(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const authUser = sessionData.session?.user;
          if (!authUser) {
            patchState(store, { user: null, loading: false });
            return;
          }

          const { data, error } = await supabase
            .from('profiles')
            .select(`*, seller_profiles(*, ${SELLER_CITY_EMBED}), customer_profiles(*)`)
            .eq('id', authUser.id)
            .single();
          if (error) throw error;

          patchState(store, { user: mapProfileRow(data as ProfileRow), loading: false });
        } catch (err) {
          // Nothing renders `error`, and a null user reads as "no role": every
          // *hasRole element vanishes and the role guards redirect. Log it, or
          // the app degrades silently and looks like a permissions problem.
          //
          // Log the raw value, not just a message: supabase only wraps errors in
          // PostgrestError under .throwOnError(), so this is usually a plain
          // { message, details, hint, code } object — and `hint` is where
          // Postgres puts the actionable fix.
          console.error('UserStore.loadUser failed:', err);
          const message =
            err instanceof Error
              ? err.message
              : ((err as { message?: string } | null)?.message ?? 'Failed to load user');
          patchState(store, { loading: false, error: message });
        }
      },
      patchSellerProfile(sellerProfile: SellerProfile): void {
        patchState(store, { ...store.user, sellerProfile });
      },
      clearUser(): void {
        patchState(store, initialState);
      },
    };
  })
);
