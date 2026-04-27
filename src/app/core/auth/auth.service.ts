import { Injectable, signal } from '@angular/core';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  getCurrentUser,
  type AuthUser,
} from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<AuthUser | null>(null);
  pendingEmail = signal<string | null>(null);

  async register(username: string, email: string, password: string) {
    const result = await signUp({
      username: email,
      password,
      options: {
        userAttributes: { email, preferred_username: username },
      },
    });
    this.pendingEmail.set(email);
    return result;
  }

  async login(email: string, password: string) {
    const result = await signIn({ username: email, password });
    if (result.isSignedIn) {
      await this.loadCurrentUser();
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
