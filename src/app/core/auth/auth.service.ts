import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  confirmSignIn,
  resendSignUpCode,
  getCurrentUser,
  signInWithRedirect,
  type AuthUser,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { UserStore } from '../store/user.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userStore = inject(UserStore);
  private platformId = inject(PLATFORM_ID);

  currentUser = signal<AuthUser | null>(null);
  pendingEmail = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      Hub.listen('auth', ({ payload }) => {
        if (payload.event === 'signInWithRedirect') {
          this.loadCurrentUser().then(() => this.userStore.loadUser());
        }
      });
    }
  }

  async register(username: string, email: string, password: string) {
    const result = await signUp({
      username: email,
      password,
      options: {
        userAttributes: { email, preferred_username: username, profile: 'BUYER' },
      },
    });
    this.pendingEmail.set(email);
    return result;
  }

  async login(email: string, password: string) {
    const result = await signIn({ username: email, password });

    // PASSWORD_VERIFIER appears as a custom challenge in some Cognito configurations.
    // Amplify handles standard SRP internally; here we respond automatically when it
    // surfaces as CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE so the caller sees a clean result.
    if (!result.isSignedIn && result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
      const confirmed = await confirmSignIn({ challengeResponse: password });
      if (confirmed.isSignedIn) {
        await this.loadCurrentUser();
        await this.userStore.loadUser();
      }
      return confirmed;
    }

    if (result.isSignedIn) {
      await this.loadCurrentUser();
      await this.userStore.loadUser();
    }
    return result;
  }

  async confirmSignInChallenge(challengeResponse: string) {
    const result = await confirmSignIn({ challengeResponse });
    if (result.isSignedIn) {
      await this.loadCurrentUser();
      await this.userStore.loadUser();
    }
    return result;
  }

  async verifyEmail(code: string) {
    const email = this.pendingEmail();
    if (!email) throw new Error('No pending email verification');
    const result = await confirmSignUp({ username: email, confirmationCode: code });
    this.pendingEmail.set(null);
    return result;
  }

  async resendCode() {
    const email = this.pendingEmail();
    if (!email) throw new Error('No pending email verification');
    return resendSignUpCode({ username: email });
  }

  async logout() {
    await signOut();
    this.currentUser.set(null);
    this.userStore.clearUser();
  }

  async loadCurrentUser(): Promise<AuthUser | null> {
    try {
      const user = await getCurrentUser();
      this.currentUser.set(user);
      return user;
    } catch {
      this.currentUser.set(null);
      return null;
    }
  }

  signInWithGoogle(): void {
    signInWithRedirect({ provider: 'Google' });
  }

  getErrorMessage(err: unknown): string {
    const error = err as { name?: string; message?: string };
    switch (error.name) {
      case 'UsernameExistsException':
        return 'An account with this email already exists.';
      case 'InvalidPasswordException':
        return 'Password does not meet requirements (min 8 chars, upper, lower, number, symbol).';
      case 'InvalidParameterException':
        return 'Invalid email or password format.';
      case 'NotAuthorizedException':
        return 'Incorrect email or password.';
      case 'UserNotConfirmedException':
        return 'Please verify your email address first.';
      case 'UserNotFoundException':
        return 'No account found with this email.';
      case 'CodeMismatchException':
        return 'Invalid verification code. Please try again.';
      case 'ExpiredCodeException':
        return 'Verification code has expired. Please request a new one.';
      case 'LimitExceededException':
        return 'Too many attempts. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
}
