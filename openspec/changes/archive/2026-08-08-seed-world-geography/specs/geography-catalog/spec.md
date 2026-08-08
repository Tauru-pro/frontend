## ADDED Requirements

### Requirement: Countries carry ISO, dialing and flag attributes
The system SHALL store, for every country, an ISO 3166-1 alpha-2 code (`iso2`, unique), an alpha-3 code (`iso3`), an international dialing prefix (`phonecode`) and a flag emoji (`emoji`), in addition to its name. `iso2` SHALL be unique across the catalog and stored in uppercase.

#### Scenario: Reading a country with its identifiers
- **WHEN** any client queries a country from the catalog
- **THEN** the system returns its `name`, `iso2`, `iso3`, `phonecode` and `emoji`

#### Scenario: Duplicate ISO code rejected
- **WHEN** a write attempts to insert a second country with an `iso2` value that already exists
- **THEN** the system rejects the write with a uniqueness violation

### Requirement: Catalog rows are keyed to the upstream dataset
The system SHALL store the upstream dataset identifier (`external_id`) on countries, states and cities, unique within each table, so that repeated seed runs reconcile rows by stable identity instead of by name.

#### Scenario: Re-running the seed after an upstream rename
- **WHEN** the upstream dataset renames a city while keeping its identifier
- **AND** the seed script runs again
- **THEN** the system updates the existing row's name in place instead of creating a duplicate row

#### Scenario: Rows predating the dataset
- **WHEN** a row seeded before this change has no `external_id`
- **THEN** the system still allows it to exist, and the seed reconciliation matches it against the dataset by normalized name

### Requirement: World geographic data is seeded from the canonical dataset
The system SHALL provide a seed script that populates the full worldwide catalog — every country, state and city of the `dr5hn/countries-states-cities-database` `countries+states+cities.json` dataset — using service_role credentials. The script SHALL be idempotent: re-running it MUST NOT create duplicate rows nor change the identifiers of rows already referenced elsewhere.

#### Scenario: First full run
- **WHEN** an operator runs the seed script with valid service_role credentials against a catalog holding only the legacy Colombian data
- **THEN** the system inserts every country, state and city of the dataset and reports the counts inserted at each level

#### Scenario: Repeated run
- **WHEN** the operator runs the seed script a second time
- **THEN** the system leaves the row count unchanged and preserves every existing row identifier

#### Scenario: Missing credentials
- **WHEN** the seed script runs without `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`
- **THEN** the script exits with a non-zero status and an explanatory message, without writing anything

### Requirement: Legacy Colombian rows are reconciled without breaking references
The seed SHALL reconcile pre-existing Colombian rows (those without `external_id`) against their dataset counterparts by comparing accent- and case-insensitive names within the same parent. When a match is found, the legacy row SHALL adopt the dataset's `external_id` and attributes rather than being duplicated. A legacy row that has no dataset counterpart SHALL be kept when any record references it, and MAY be deleted only when it is unreferenced.

#### Scenario: Legacy department matched to dataset state
- **WHEN** the legacy state "Antioquia" exists under Colombia and the dataset contains a state "Antioquia" for Colombia
- **THEN** the system keeps the existing row id, sets its `external_id` and updates its attributes

#### Scenario: Referenced legacy city with no counterpart
- **WHEN** a legacy city has no matching city in the dataset and is referenced by a branch or a seller profile
- **THEN** the system keeps the row and reports it in the reconciliation summary

#### Scenario: Unreferenced legacy city with no counterpart
- **WHEN** a legacy city has no matching city in the dataset and no record references it
- **THEN** the system deletes the row

### Requirement: Angular service provides the list of countries
The system SHALL expose a `LocationService.getCountries()` method returning an Observable of countries — id, name, `iso2`, `phonecode` and `emoji` — ordered alphabetically by name.

#### Scenario: Loading countries
- **WHEN** a component calls `getCountries()`
- **THEN** the service returns every country of the catalog ordered alphabetically, each carrying its flag emoji and dialing prefix

### Requirement: Angular service provides cities filtered by state id
The system SHALL expose a `LocationService.getCities(stateId)` method that returns an Observable of the cities belonging to the state with that identifier, ordered alphabetically by name.

#### Scenario: Loading cities for a state
- **WHEN** a component calls `getCities(antioquiaId)`
- **THEN** the service returns the municipalities of Antioquia ordered alphabetically, and no city of a same-named state in another country

#### Scenario: Switching state
- **WHEN** a component calls `getCities` with a different state identifier
- **THEN** the service returns the cities of the newly specified state

### Requirement: Location selector lets the user choose a country
The location selector SHALL present three dependent combos — country, state and city — where choosing a country resets and reloads the states, and choosing a state resets and reloads the cities. It SHALL preselect Colombia when no initial value is supplied, and emit the selected `countryId`, `stateId` and `cityId` together.

#### Scenario: Default country
- **WHEN** the selector is rendered without initial values
- **THEN** Colombia is preselected and its states are loaded

#### Scenario: Changing country
- **WHEN** the user picks a different country
- **THEN** the state and city selections are cleared and the states of the newly chosen country are loaded

#### Scenario: Complete selection emitted
- **WHEN** the user has chosen a country, a state and a city
- **THEN** the selector emits all three identifiers

#### Scenario: Editing an existing record
- **WHEN** the selector receives an initial city id
- **THEN** it resolves and preselects the owning country and state, and loads both dependent lists

## MODIFIED Requirements

### Requirement: Angular service provides states filtered by country
The system SHALL expose a `LocationService.getStates(countryId)` method that returns an Observable of the states belonging to the country with that identifier, ordered alphabetically by name. Filtering SHALL be done by identifier, not by country name, because names are not unique selectors across the worldwide catalog.

#### Scenario: Loading states for a country
- **WHEN** a component calls `getStates(colombiaId)`
- **THEN** the service returns the 32 departments plus the capital district of Colombia ordered alphabetically

#### Scenario: Country with no states
- **WHEN** a component calls `getStates` with the id of a country that has no states in the dataset
- **THEN** the service returns an empty list without erroring

## REMOVED Requirements

### Requirement: Colombia geographic data is seeded at setup time
**Reason**: El marketplace deja de ser exclusivamente colombiano; la fuente de datos específica de Colombia se reemplaza por el dataset mundial.
**Migration**: Reemplazada por "World geographic data is seeded from the canonical dataset". Los datos colombianos existentes se conservan mediante la reconciliación por nombre normalizado descrita en "Legacy Colombian rows are reconciled without breaking references"; no requiere acción manual más allá de ejecutar `npm run seed:geography`.

### Requirement: Angular service provides cities filtered by state name
**Reason**: Los nombres de estado se repiten entre países en el catálogo mundial (p. ej. "Córdoba" en Colombia, Argentina y España), por lo que filtrar por nombre devuelve ciudades de países ajenos.
**Migration**: Reemplazada por `LocationService.getCities(stateId)`. Los llamadores que pasaban el nombre del departamento deben pasar el `stateId` que ya reciben del selector de estado.
