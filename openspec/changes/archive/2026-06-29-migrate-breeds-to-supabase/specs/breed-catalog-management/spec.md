## ADDED Requirements

### Requirement: Public read access to the breed catalog
The system SHALL allow any visitor, authenticated or not, to read the full list of breeds, since the breed catalog is used by the public marketplace and by sellers listing bulls.

#### Scenario: Unauthenticated visitor loads the marketplace home page
- **WHEN** an unauthenticated visitor loads the home page
- **THEN** the system successfully fetches and displays the breed list with no session required

#### Scenario: Seller selects a breed when listing a bull
- **WHEN** a `SELLER` opens the bull creation form
- **THEN** the system successfully fetches and displays the breed list to populate the breed selector

### Requirement: SUPER_ADMIN-only breed catalog management
The system SHALL allow only users with role `SUPER_ADMIN` to create, edit, or delete breeds, and SHALL reject the operation for any other caller at the server layer, not only in the UI.

#### Scenario: SUPER_ADMIN creates a breed
- **WHEN** a `SUPER_ADMIN` submits the "new breed" form with a name and purpose
- **THEN** the system creates the breed and it appears in the breed list

#### Scenario: SUPER_ADMIN edits or deletes a breed
- **WHEN** a `SUPER_ADMIN` edits or deletes an existing breed
- **THEN** the system applies the change and reflects it in the breed list

#### Scenario: Non-SUPER_ADMIN cannot write to the breed catalog
- **WHEN** a request to create, update, or delete a breed is made by a caller whose verified role claim is not `SUPER_ADMIN`
- **THEN** the system rejects the request, even if the request bypasses the UI and calls the database directly

### Requirement: Breed management routes restricted to SUPER_ADMIN
The system SHALL restrict `/admin/breeds`, `/admin/breeds/new`, and `/admin/breeds/:id/edit` to users with role `SUPER_ADMIN`, denying access to `ADMIN` and any other role.

#### Scenario: ADMIN is denied access to breed management
- **WHEN** a user with role `ADMIN` navigates to `/admin/breeds` or `/admin/breeds/new`
- **THEN** access is denied and the user is redirected away

#### Scenario: SUPER_ADMIN can access breed management
- **WHEN** a user with role `SUPER_ADMIN` navigates to `/admin/breeds`
- **THEN** access is granted and the breed list/management UI is shown

### Requirement: Duplicate breed names are rejected
The system SHALL prevent two breeds from sharing the same name and SHALL surface a clear error to the `SUPER_ADMIN` when a duplicate is attempted.

#### Scenario: Creating a breed with an existing name
- **WHEN** a `SUPER_ADMIN` submits a breed name that already exists in the catalog
- **THEN** the system rejects the creation and the form shows a duplicate-name error
