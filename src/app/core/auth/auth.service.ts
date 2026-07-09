import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { AuthError, User } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client';
import { UserStore } from '../store/user.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userStore = inject(UserStore);
  private platformId = inject(PLATFORM_ID);
  private supabase = inject(SupabaseClientService).client;

  currentUser = signal<User | null>(null);
  pendingEmail = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.currentUser.set(session?.user ?? null);
        if (event === 'SIGNED_IN') this.userStore.loadUser();
        if (event === 'SIGNED_OUT') this.userStore.clearUser();
      });
    }
  }

  async register(fullName: string, email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    this.pendingEmail.set(email);
    return data;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser.set(data.user);
    await this.userStore.loadUser();
    return data;
  }

  signInWithGoogle(): void {
    this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async verifyEmail(code: string) {
    const email = this.pendingEmail();
    if (!email) throw new Error('No pending email verification');
    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    });
    if (error) throw error;
    this.pendingEmail.set(null);
    return data;
  }

  async resendCode() {
    const email = this.pendingEmail();
    if (!email) throw new Error('No pending email verification');
    const { error } = await this.supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }

  // Used after an invite/recovery link establishes a session with no
  // password set yet (see features/auth/set-password).
  async setPassword(password: string) {
    const { data, error } = await this.supabase.auth.updateUser({ password });
    if (error) throw error;
    return data;
  }

  async logout() {
    await this.supabase.auth.signOut();
    this.currentUser.set(null);
    this.userStore.clearUser();
  }

  async loadCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getSession();
    const user = data.session?.user ?? null;
    this.currentUser.set(user);
    return user;
  }

  isEmailNotConfirmedError(err: unknown): boolean {
    return (err as { code?: string })?.code === 'email_not_confirmed';
  }

  getErrorMessage(err: unknown): string {
    const error = err as AuthError;
    switch (error.code) {
      case 'invalid_credentials':
        return 'Correo o contraseña incorrectos.';
      case 'email_not_confirmed':
        return 'Primero verifica tu correo electrónico.';
      case 'user_already_exists':
        return 'Ya existe una cuenta con este correo.';
      case 'weak_password':
        return 'La contraseña no cumple los requisitos (mínimo 8 caracteres, mayúscula, minúscula, número y símbolo).';
      case 'otp_expired':
        return 'El código de verificación expiró. Solicita uno nuevo.';
      case 'over_email_send_rate_limit':
        return 'Demasiados intentos. Inténtalo más tarde.';
      default:
        return error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    }
  }
}
