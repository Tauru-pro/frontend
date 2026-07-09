## ADDED Requirements

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
