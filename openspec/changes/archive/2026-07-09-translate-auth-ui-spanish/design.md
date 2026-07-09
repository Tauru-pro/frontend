## Context

The auth feature lives under `src/app/features/auth/` as standalone, `OnPush`, inline-template components. Copy is hardcoded inline in the templates (there is no i18n/translation layer in the project). Validation messages are hardcoded in each component's reactive `form(...)` schema (`@angular/forms/signals`), and shared authentication error messages come from `AuthService.getErrorMessage()` in `src/app/core/auth/auth.service.ts`. `set-password.component.ts` is already fully Spanish and serves as the tone/terminology reference.

## Goals / Non-Goals

**Goals:**
- Replace all English user-facing copy on `sign-in`, `sign-up`, `verify-email`, and `callback` with Spanish, consistent with the existing `set-password` screen.
- Translate client-side validation messages and the shared `getErrorMessage()` strings that surface on these screens.
- Keep terminology consistent across screens via a single glossary.

**Non-Goals:**
- No i18n framework, locale switching, or extraction to translation files — copy stays inline (matches current architecture).
- No changes to `set-password` (already Spanish), auth logic, routing, guards, or backend.
- No visual/layout redesign.

## Decisions

- **Inline translation, no i18n layer.** Edit strings in place rather than introducing `@angular/localize` or a message catalog. Rationale: the whole app uses inline Spanish copy today; adding an i18n layer is a much larger, out-of-scope change. Alternative (i18n extraction) rejected as over-engineering for a single-locale app.
- **Reuse `set-password` as the terminology anchor** so shared terms match exactly (e.g. `Contraseña`, `Mínimo 8 caracteres`, `Repite tu contraseña`, `Las contraseñas no coinciden`, `Volver a iniciar sesión`).
- **Preserve brand/proper nouns:** `Tauru`, `Market`, `Google`, `Facebook` stay unchanged.
- **Shared glossary** (applied everywhere):
  - Login / Log In → `Iniciar sesión`; Register / Create Account → `Registrarse` / `Crear cuenta`
  - Email address → `Correo electrónico`; Password → `Contraseña`; Confirm password → `Confirmar contraseña`; Full name → `Nombre completo`
  - Remember me → `Recordarme`; Lost your password? → `¿Olvidaste tu contraseña?`
  - Or login with / Or sign up with → `O inicia sesión con` / `O regístrate con`
  - Don't have an account? Register here → `¿No tienes una cuenta? Regístrate aquí`
  - Already have an account? Log in here → `¿Ya tienes una cuenta? Inicia sesión aquí`
  - Loading states: `Iniciando sesión...`, `Creando cuenta...`, `Verificando...`, `Enviando...`
  - Verify email → `Verifica tu correo`; "We sent a 6-digit code to" → `Enviamos un código de 6 dígitos a`; Verification code → `Código de verificación`; Resend code → `Reenviar código`; "Code resent! Check your inbox." → `¡Código reenviado! Revisa tu bandeja de entrada.`; Wrong email? Go back to sign up → `¿Correo incorrecto? Volver al registro`
  - Callback: Completing sign in... → `Completando el inicio de sesión...`; Authentication failed → `Error de autenticación`; Back to Sign In → `Volver a iniciar sesión`
  - Error messages (`getErrorMessage`): `Correo o contraseña incorrectos.`, `Primero verifica tu correo electrónico.`, `Ya existe una cuenta con este correo.`, `La contraseña no cumple los requisitos (mínimo 8 caracteres, mayúscula, minúscula, número y símbolo).`, `El código de verificación expiró. Solicita uno nuevo.`, `Demasiados intentos. Inténtalo más tarde.`, default `Ocurrió un error inesperado. Inténtalo de nuevo.`
  - Placeholders: keep the `you@example.com` email placeholder as-is; translate descriptive placeholders (`Min. 8 characters` → `Mínimo 8 caracteres`, `Repeat your password` → `Repite tu contraseña`, `Enter 6-digit code` → `Ingresa el código de 6 dígitos`); localize the sample name placeholder (`John Doe` → `Juan Pérez`).

## Risks / Trade-offs

- [Inline copy stays duplicated across screens] → Mitigated by the shared glossary above; if drift becomes a problem later, extract to constants/i18n as a separate change.
- [`error.message` fallback in `getErrorMessage()` may return provider (English) text] → Acceptable: only translate the controlled default and known error codes; raw provider messages are an edge case outside this change's scope.
