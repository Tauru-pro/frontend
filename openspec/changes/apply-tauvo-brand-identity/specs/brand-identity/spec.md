## ADDED Requirements

### Requirement: Corporate color tokens

The design system SHALL expose the TAUVO corporate palette as CSS custom properties in the `@theme` block of [src/styles.css](src/styles.css), so that every component styled through Tailwind semantic colors renders in the brand colors. The token values MUST match the Manual de Identidad TAUVO (§03 Paleta de Color).

The mapping SHALL be:
- `--color-primary` = Verde Primario `#1B7A3F`
- `--color-primary-dark` = Verde Oscuro `#0D4A26`
- `--color-secondary` = Verde Claro `#4CAF7D`
- accent = a green-family / supporting tone (Azul Tormenta `#A4C5D8` is the only non-green support color and MAY be used where a cool contrast is needed); the amber accent SHALL be removed
- dark surfaces / footer = Negro Corporativo `#1A1A1A`
- body text tone = Carbón Tipográfico `#2D2D2D`
- `--color-card` / base light surface = Blanco `#FFFFFF`

#### Scenario: Primary color resolves to TAUVO green

- **WHEN** any element using `bg-primary` or `text-primary` is rendered
- **THEN** its color resolves to `#1B7A3F`, not the legacy cobalt `#060d1a`

#### Scenario: No amber remains in the theme

- **WHEN** the `@theme` block in `styles.css` is inspected
- **THEN** no accent token resolves to the legacy amber `#f59e0b` / `#d97706`

### Requirement: Typography token structure with documented font slot

The design system SHALL define typography tokens for the manual's families — a heading/CTA family (Gotham/Inter) and a subtitle/label family (Montserrat) — and SHALL provide a single clearly named, commented location in [src/styles.css](src/styles.css) that names the expected font files and their path where the licensed fonts get wired in later. The actual font files SHALL NOT be added in this change; IBM Plex Sans SHALL remain the working fallback until the files are provided.

#### Scenario: Font slot is documented and named

- **WHEN** a developer opens `styles.css` to add the brand fonts
- **THEN** a commented slot names the font files and the path (e.g. `public/brand/fonts/`) and the `@font-face`/`@import` line to fill in, with no guessing required

#### Scenario: App still renders before fonts are added

- **WHEN** the app runs without the licensed font files present
- **THEN** text renders in the IBM Plex Sans fallback rather than an invisible or broken font

### Requirement: Logo asset contract with documented paths

The design system SHALL define the filenames and paths under `public/brand/` for the TAUVO logo variants (logosímbolo / bull head, wordmark, and full lockup) and SHALL document which UI surfaces consume each variant. The actual artwork SHALL NOT be produced in this change; the inline "T" box SHALL remain as the fallback until the real files are dropped in at the documented paths, requiring no further code changes.

#### Scenario: Logo paths are documented

- **WHEN** a designer delivers the logo files
- **THEN** the change documents the exact filenames and `public/brand/` paths for the bull head, wordmark, and full lockup, and lists the components that reference them

#### Scenario: Fallback shown until artwork exists

- **WHEN** the brand logo files are not yet present
- **THEN** the current inline "T" mark is shown instead of a broken image

### Requirement: Brand wordmark text is TAUVO

Wherever the brand name appears as literal in-app copy, it SHALL read "TAUVO", not the legacy "Tauru".

#### Scenario: Wordmark copy updated

- **WHEN** the navbar, footer, sidebar, or an auth screen renders the brand name as text
- **THEN** it displays "TAUVO"
