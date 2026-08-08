## ADDED Requirements

### Requirement: Reusable phone input pairs a country dial code with a number
The system SHALL provide a shared `PhoneInputComponent` that renders a searchable country selector next to a telephone field. The selector SHALL list every country of the catalog showing its flag emoji, name and dial code, and the component SHALL emit the selected dial code and the typed national number as separate values.

#### Scenario: Rendering the selector
- **WHEN** the component is rendered
- **THEN** the country selector lists the catalog countries, each showing flag, name and dial code, and the number field is empty

#### Scenario: Entering a number
- **WHEN** the user picks a country and types a national number
- **THEN** the component emits that dial code and that number as separate values

#### Scenario: Searching a country
- **WHEN** the user types into the country selector
- **THEN** the list narrows to the countries whose name or dial code matches the typed text

### Requirement: Colombia is the default dial code
The component SHALL preselect Colombia (`+57`) when it receives no dial code, so that a user who only types a number still produces a complete phone value.

#### Scenario: No initial value
- **WHEN** the component is rendered without an initial dial code
- **THEN** Colombia is preselected and its dial code is used for whatever number the user types

#### Scenario: Initial dial code supplied
- **WHEN** the component receives an initial dial code
- **THEN** it preselects the country matching that dial code instead of Colombia

### Requirement: Phone numbers persist the dial code separately from the number
The system SHALL store the dial code and the national number in separate columns for every phone field it owns: the buyer's phone and WhatsApp, the seller's contact phone, and the branch phone. The dial code SHALL be stored in `+<digits>` form and the number column SHALL hold only the national number.

#### Scenario: Saving a phone
- **WHEN** a user saves a form with a country and a national number
- **THEN** the system writes `+57` (or the chosen code) to the dial code column and the bare national number to the number column

#### Scenario: Reloading a saved phone
- **WHEN** a form that holds a saved phone is reopened
- **THEN** the country selector shows the stored dial code's country and the number field shows the national number

#### Scenario: Clearing an optional phone
- **WHEN** a user empties an optional phone field and saves
- **THEN** the system stores no number, and the record is treated as having no phone

### Requirement: Existing phone numbers are split during migration
Phone values stored before this change SHALL be split into a dial code and a national number. A value already starting with a known dial code SHALL keep that code; a value with no prefix SHALL be assigned `+57`, since the marketplace was Colombia-only until now.

#### Scenario: Legacy number with no prefix
- **WHEN** a stored phone is `3001112222`
- **THEN** the migration records `+57` as its dial code and `3001112222` as its number

#### Scenario: Legacy number that already carries a prefix
- **WHEN** a stored phone is `+57 300 111 2222`
- **THEN** the migration records `+57` as its dial code and the remaining digits as its number

#### Scenario: Empty phone
- **WHEN** a stored phone is null or empty
- **THEN** the migration leaves both the dial code and the number empty

### Requirement: All phone capture points use the shared component
Every screen that asks for a telephone number SHALL use `PhoneInputComponent` rather than a bare input: buyer profile (phone and WhatsApp), seller onboarding, seller settings, branch form and checkout.

#### Scenario: Two phone fields on one screen
- **WHEN** the buyer profile renders its phone and WhatsApp fields
- **THEN** both are instances of the shared component and each keeps its own country selection

#### Scenario: Checkout submits a single field
- **WHEN** the buyer completes checkout with a country and a number
- **THEN** the order payload carries the phone as one `+<code><number>` string, because the checkout API stores a single phone field

### Requirement: Seller onboarding persists the dial code
The `submit_seller_onboarding` procedure SHALL accept the contact phone's dial code alongside the number and persist both on the seller profile.

#### Scenario: Onboarding with a phone
- **WHEN** an applicant submits onboarding with a country and a contact number
- **THEN** the seller profile is created with the dial code and the number in their own columns
