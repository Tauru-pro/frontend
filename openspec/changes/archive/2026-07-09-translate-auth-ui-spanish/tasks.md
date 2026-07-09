## 1. Sign-in screen (`sign-in/sign-in.component.ts`)

- [x] 1.1 Translate tabs (`Login`/`Register`), the `Email address` and `Password` labels, and the `Remember me` option
- [x] 1.2 Translate the submit button (`Log In` / `Logging in...`) and the `Lost your password?` link
- [x] 1.3 Translate the divider (`Or login with`) and the `Don't have an account? Register here` footer link (keep `Google`/`Facebook` labels)
- [x] 1.4 Translate the form validation messages in the `signInForm` schema (required/email/minLength)

## 2. Sign-up screen (`sign-up/sign-up.component.ts`)

- [x] 2.1 Translate tabs, the `Full name` / `Email address` / `Password` / `Confirm password` labels, and their descriptive placeholders (localize the `John Doe` sample name; keep `you@example.com`)
- [x] 2.2 Translate the submit button (`Create Account` / `Creating account...`) and the terms/privacy note (`Terms of Service`, `Privacy Policy`)
- [x] 2.3 Translate the divider (`Or sign up with`) and the `Already have an account? Log in here` footer link
- [x] 2.4 Translate the form validation messages in the `signUpForm` schema (required/email/minLength/mismatch)

## 3. Verify-email screen (`verify-email/verify-email.component.ts`)

- [x] 3.1 Translate the heading (`Verify your email`), the instructional text (`We sent a 6-digit code to` + `your email address` fallback)
- [x] 3.2 Translate the resend success message, the `Verification code` label, and the `Enter 6-digit code` placeholder
- [x] 3.3 Translate the buttons/states (`Verify Email` / `Verifying...`, `Resend code` / `Sending...`) and the `Didn't receive the code?` + `Wrong email? Go back to sign up` links

## 4. Callback screen (`callback/callback.component.ts`)

- [x] 4.1 Translate the `Completing sign in...` status and the `Authentication failed` heading
- [x] 4.2 Translate the `Back to Sign In` link and the `Sign in with Google failed. Please try again.` error string

## 5. Shared error messages (`core/auth/auth.service.ts`)

- [x] 5.1 Translate all case strings in `getErrorMessage()` and the default fallback message to Spanish (per the glossary in design.md)

## 6. Verification

- [x] 6.1 Confirm terminology is consistent with the existing `set-password` screen (`Contraseña`, `Mínimo 8 caracteres`, `Volver a iniciar sesión`, etc.)
- [x] 6.2 Run `npm run build` to confirm the app compiles with no template/type errors
- [x] 6.3 Run `npm start` and verify each screen (`/auth/sign-in`, `/auth/sign-up`, `/auth/verify-email`, `/auth/callback`) shows Spanish copy — verified via SSR fetch (all Spanish strings present, no English leftovers)
