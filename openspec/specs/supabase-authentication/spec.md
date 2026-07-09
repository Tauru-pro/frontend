## Purpose

Provide identity and session management for the Tauru marketplace via Supabase Auth: email/password and Google OAuth sign-in, public `CUSTOMER` self-registration, email verification, sign-out, and SSR-safe session handling — replacing the previous AWS Cognito/Amplify flow.

## Requirements

### Requirement: Customer self-registration
The system SHALL allow an unauthenticated visitor to register a new account from the public sign-up page using email and password, and SHALL always assign the `CUSTOMER` role to the resulting account regardless of any role value submitted by the client.

#### Scenario: Successful registration
- **WHEN** a visitor submits a valid email and password on `/auth/sign-up`
- **THEN** the system creates a Supabase Auth user and a `profiles` row with `role = 'CUSTOMER'`, and redirects to the email verification screen

#### Scenario: Role cannot be self-assigned
- **WHEN** a client sends a `role` value of `ADMIN`, `SELLER`, or `SUPER_ADMIN` as part of the sign-up request
- **THEN** the system ignores it and stores `role = 'CUSTOMER'` for the new account

### Requirement: Email verification via one-time code
The system SHALL require a newly registered user to confirm their email using a 6-digit numeric code before they can sign in, preserving the existing verification UX.

#### Scenario: Successful verification
- **WHEN** the user enters the 6-digit code sent to their email on `/auth/verify-email`
- **THEN** the system confirms the email and the user can subsequently sign in

#### Scenario: Resend code
- **WHEN** the user requests a new code before the previous one is used
- **THEN** the system sends a new 6-digit code to the same email and invalidates the previous one

### Requirement: Email/password sign-in
The system SHALL authenticate registered users with email and password via Supabase Auth and load their profile/role before granting access to role-gated routes.

#### Scenario: Successful login
- **WHEN** a confirmed user submits correct email and password on `/auth/sign-in`
- **THEN** the system establishes a Supabase session and redirects the user based on their role (`SUPER_ADMIN`/`ADMIN` to `/admin`, `SELLER` to `/seller/products`, `CUSTOMER` to `/`)

#### Scenario: Incorrect credentials
- **WHEN** a user submits an incorrect email or password
- **THEN** the system shows an error message and does not establish a session

#### Scenario: Unconfirmed email blocks login
- **WHEN** a user with an unconfirmed email attempts to sign in
- **THEN** the system redirects them to `/auth/verify-email` instead of granting a session

### Requirement: Google OAuth sign-in
The system SHALL allow users to sign in or register via Google OAuth through Supabase Auth, completing the flow at `/auth/callback`.

#### Scenario: Successful Google sign-in
- **WHEN** a user completes the Google consent screen
- **THEN** Supabase issues a session, the system loads or creates the corresponding profile, and redirects the user based on role

### Requirement: Session sign-out
The system SHALL allow an authenticated user to end their session and clear locally cached profile state.

#### Scenario: Logout clears session and profile
- **WHEN** an authenticated user triggers logout
- **THEN** the Supabase session is terminated and the local user/profile state is cleared, sending the user to a public route

### Requirement: Server-side rendering does not require a session
The system SHALL treat server-side rendering as unauthenticated, deferring all session checks to the browser, consistent with the app's existing SSR guard behavior.

#### Scenario: SSR request bypasses session check
- **WHEN** a route is rendered on the server (no browser platform)
- **THEN** auth guards return `true` without attempting to read a Supabase session, and the real session check happens after hydration in the browser

### Requirement: Authentication screens present copy in Spanish
The system SHALL present all user-facing copy on the authentication screens — sign-in (`/auth/sign-in`), sign-up (`/auth/sign-up`), email verification (`/auth/verify-email`), and OAuth callback (`/auth/callback`) — in Spanish, including field labels and placeholders, buttons and their loading states, helper/instructional text, links, client-side form validation messages, and user-facing authentication error messages. Brand and proper nouns (`Tauru`, `Market`, `Google`, `Facebook`) SHALL be preserved as-is.

#### Scenario: Sign-in screen copy is in Spanish
- **WHEN** an unauthenticated visitor opens `/auth/sign-in`
- **THEN** the tabs, field labels, placeholders, "remember me" option, submit button and its loading state, the "forgot password" link, the social-login divider, and the "create an account" link are all shown in Spanish

#### Scenario: Sign-up screen copy is in Spanish
- **WHEN** an unauthenticated visitor opens `/auth/sign-up`
- **THEN** the field labels, placeholders, submit button and its loading state, the terms/privacy note, the social-login divider, and the "already have an account" link are all shown in Spanish

#### Scenario: Verify-email screen copy is in Spanish
- **WHEN** a user reaches `/auth/verify-email`
- **THEN** the heading, instructional text, code field label and placeholder, verify button and its loading state, the resend control and its success message, and the "wrong email" link are all shown in Spanish

#### Scenario: Callback screen copy is in Spanish
- **WHEN** a user completes (or fails) OAuth sign-in and lands on `/auth/callback`
- **THEN** the "completing sign in" status, the failure heading and message, and the "back to sign in" link are all shown in Spanish

#### Scenario: Validation and authentication errors are in Spanish
- **WHEN** a user submits an auth form with invalid input or authentication fails (e.g. incorrect credentials, unconfirmed email, weak password, expired code, rate limit)
- **THEN** the corresponding client-side validation message and the resulting authentication error message are displayed in Spanish
