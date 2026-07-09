## Why

Tauru's UI copy is standardized in Spanish (per project conventions), but the authentication screens still ship the original English scaffold copy (labels, buttons, helper text, validation and error messages). This is inconsistent with the rest of the marketplace and with `set-password`, which is already fully in Spanish, and it degrades the experience for the Spanish-speaking audience.

## What Changes

- Translate all user-facing copy on the **sign-in** screen (`/auth/sign-in`): tabs, field labels/placeholders, "Remember me", submit/loading text, "Lost your password?", divider ("Or login with"), and the "Don't have an account?" link.
- Translate all user-facing copy on the **sign-up** screen (`/auth/sign-up`): tabs, field labels/placeholders, submit/loading text, terms-of-service note, divider, and the "Already have an account?" link.
- Translate all user-facing copy on the **verify-email** screen (`/auth/verify-email`): heading, instructional text, resend success message, field label/placeholder, buttons, and the resend/"Wrong email?" links.
- Translate all user-facing copy on the **callback** screen (`/auth/callback`): "Completing sign in…", "Authentication failed", the Google-failure message, and the "Back to Sign In" link.
- Translate the client-side **form validation messages** in the sign-in and sign-up reactive forms (required/email/minLength/mismatch).
- Translate the shared, user-facing **error strings** returned by `AuthService.getErrorMessage()` (and related fallbacks), since they render inside these auth screens.
- Preserve brand/proper nouns as-is: `Tauru`, `Market`, `Google`, `Facebook`, and payment/OAuth provider names.

Out of scope: the **set-password** screen (already fully Spanish) and any change to auth logic, routing, or backend behavior — copy only.

## Capabilities

### New Capabilities
<!-- None: no new capability is introduced; this is a localization change to existing auth screens. -->

### Modified Capabilities
- `supabase-authentication`: Add a requirement that all authentication screen copy — labels, buttons, helper text, validation and error messages — is presented in Spanish, so the auth capability's user-facing text matches the marketplace's Spanish locale.

## Impact

- **Components (copy only):** `src/app/features/auth/sign-in/sign-in.component.ts`, `src/app/features/auth/sign-up/sign-up.component.ts`, `src/app/features/auth/verify-email/verify-email.component.ts`, `src/app/features/auth/callback/callback.component.ts`.
- **Service (user-facing strings only):** `src/app/core/auth/auth.service.ts` (`getErrorMessage()` and default fallback message).
- **No changes** to templates' structure/logic, routes, guards, DTOs, or backend contracts. No breaking changes; visual layout is unaffected.
