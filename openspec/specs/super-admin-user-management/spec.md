## Purpose

Define the role hierarchy (`SUPER_ADMIN` > `ADMIN` > `SELLER` > `CUSTOMER`), the default `SUPER_ADMIN` bootstrap, and the admin-panel capability for listing and creating privileged user accounts, restricted to `SUPER_ADMIN`.

## Requirements

### Requirement: Role hierarchy
The system SHALL support four roles ordered as `SUPER_ADMIN` > `ADMIN` > `SELLER` > `CUSTOMER`, where `SUPER_ADMIN` inherits access to everything `ADMIN` can access.

#### Scenario: SUPER_ADMIN can access admin-only routes
- **WHEN** a user with role `SUPER_ADMIN` navigates to a route guarded by the admin guard
- **THEN** access is granted, the same as for `ADMIN`

#### Scenario: ADMIN cannot access super-admin-only routes
- **WHEN** a user with role `ADMIN` navigates to `/admin/users` or `/admin/users/new`
- **THEN** access is denied and the user is redirected away

### Requirement: Default SUPER_ADMIN bootstrap
The system SHALL provide exactly one `SUPER_ADMIN` account by default after the Supabase project is provisioned, created via an out-of-band seed script rather than through the public UI.

#### Scenario: Default super admin can sign in immediately after provisioning
- **WHEN** the seed script has run against a fresh Supabase project
- **THEN** a user with role `SUPER_ADMIN` exists and can sign in and access `/admin/users`

### Requirement: SUPER_ADMIN-only user creation
The system SHALL allow only users with role `SUPER_ADMIN` to create new `SELLER` or `SUPER_ADMIN` accounts, and SHALL reject the operation for any other caller at the server layer, not only in the UI.

#### Scenario: SUPER_ADMIN creates a SELLER account
- **WHEN** a `SUPER_ADMIN` submits the "new user" form with role `SELLER`
- **THEN** the system creates the account, sends an invitation email, and the new account appears in the paginated user list with role `SELLER`

#### Scenario: Non-super-admin cannot create privileged accounts
- **WHEN** a request to create a `SELLER` or `SUPER_ADMIN` account is made by a caller whose verified role claim is not `SUPER_ADMIN`
- **THEN** the system rejects the request, even if the request bypasses the UI and calls the server function directly

### Requirement: Paginated user listing
The system SHALL display all user accounts in a paginated list, restricted to `SUPER_ADMIN`, reusing the existing table/pagination UI.

#### Scenario: SUPER_ADMIN views a page of users
- **WHEN** a `SUPER_ADMIN` opens `/admin/users`
- **THEN** the system shows up to the configured page size of users with their name/email, role, status, and creation date, along with pagination controls

#### Scenario: Navigating between pages
- **WHEN** a `SUPER_ADMIN` selects a different page in the user list
- **THEN** the system fetches and displays that page's users without reloading the whole app

### Requirement: Customer accounts cannot be created from the admin panel
The system SHALL NOT offer `CUSTOMER` as a selectable role in the SUPER_ADMIN "create user" form, since customer accounts are only created via public self-registration.

#### Scenario: Create-user form only offers privileged roles
- **WHEN** a `SUPER_ADMIN` opens the "new user" form
- **THEN** only `SELLER` and `SUPER_ADMIN` appear as selectable roles
