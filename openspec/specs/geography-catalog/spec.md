## Requirements

### Requirement: System stores a public catalog of countries, states, and cities
The system SHALL maintain a normalized three-level geographic catalog (countries → states → cities) stored in Supabase, publicly readable without authentication, and immutable by end users (insert/update/delete restricted to service_role).

#### Scenario: Unauthenticated read of states
- **WHEN** any client queries states for a given country
- **THEN** the system returns the full list of states for that country without requiring authentication

#### Scenario: Unauthenticated read of cities
- **WHEN** any client queries cities for a given state
- **THEN** the system returns the full list of cities for that state without requiring authentication

#### Scenario: Unauthorized write attempt
- **WHEN** an authenticated or unauthenticated user attempts to insert, update, or delete a country, state, or city
- **THEN** the system denies the operation

### Requirement: Colombia geographic data is seeded at setup time
The system SHALL include a one-time seed script that populates Colombia (country), its 32 departments (states), and all municipalities (cities) by fetching data from the canonical Colombia JSON source.

#### Scenario: Running the seed script
- **WHEN** an operator runs the seed script with valid service_role credentials
- **THEN** the system inserts Colombia, all 32 departments, and all municipalities; subsequent runs are idempotent (upsert on name + parent FK)

### Requirement: Angular service provides states filtered by country
The system SHALL expose a `LocationService.getStates(countryName?)` method that returns an Observable of states belonging to the specified country, defaulting to Colombia when no country name is provided.

#### Scenario: Loading states with default country
- **WHEN** a component calls `getStates()` without arguments
- **THEN** the service returns the departments of Colombia ordered alphabetically

#### Scenario: Loading states for a specific country
- **WHEN** a component calls `getStates('Colombia')`
- **THEN** the service returns the same result as the default call

### Requirement: Angular service provides cities filtered by state name
The system SHALL expose a `LocationService.getCities(stateName)` method that returns an Observable of cities belonging to the named state.

#### Scenario: Loading cities for a department
- **WHEN** a component calls `getCities('Antioquia')`
- **THEN** the service returns all municipalities of Antioquia ordered alphabetically

#### Scenario: Switching department
- **WHEN** a component calls `getCities` with a different department name
- **THEN** the service returns the cities of the newly specified department
