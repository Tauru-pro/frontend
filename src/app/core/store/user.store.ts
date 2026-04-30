import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SellerProfile, UserProfile } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface UserState {
  user: UserProfile | null;
  sellerProfile: SellerProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = { user: null, sellerProfile: null, loading: false, error: null };

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState<UserState>(initialState),
  withMethods((store) => {
    const http = inject(HttpClient);
    return {
      async loadUser(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const user = await firstValueFrom(
            http.get<UserProfile>(`${environment.apiUrl}/auth/me`)
          );
          patchState(store, { user, loading: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load user';
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
