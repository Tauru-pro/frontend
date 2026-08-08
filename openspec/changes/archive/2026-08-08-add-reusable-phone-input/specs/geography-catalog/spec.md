## MODIFIED Requirements

### Requirement: Angular service provides the list of countries
The system SHALL expose a `LocationService.getCountries()` method returning an Observable of countries — id, name, `iso2`, `phonecode` and `emoji` — ordered alphabetically by name. The result SHALL be cached and shared across subscribers, so that several country selectors rendered on the same screen trigger a single query.

#### Scenario: Loading countries
- **WHEN** a component calls `getCountries()`
- **THEN** the service returns every country of the catalog ordered alphabetically, each carrying its flag emoji and dialing prefix

#### Scenario: Several selectors on one screen
- **WHEN** two or more components call `getCountries()` during the same session
- **THEN** the catalog is fetched once and the same list is served to every caller
