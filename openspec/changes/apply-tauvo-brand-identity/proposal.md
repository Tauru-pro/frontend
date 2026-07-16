## Why

The app currently ships the legacy "Tauru" identity (cobalt-blue primary + amber accent, IBM Plex Sans, an inline "T" letter box as a stand-in logo). The official **Manual de Identidad TAUVO** (v1.0, 2026) defines a different brand: a green-led palette, a Gotham/Inter + Montserrat type system, and a real bull-head logo with a wordmark and tagline. Until the product matches the manual, every screen is off-brand.

## What Changes

- **BREAKING (visual):** Replace the color system in [src/styles.css](src/styles.css) `@theme` tokens with the TAUVO palette from the manual (Verde Primario `#1B7A3F`, Verde Claro `#4CAF7D`, Verde Oscuro `#0D4A26`, Negro `#1A1A1A`, Carbón `#2D2D2D`, Blanco, Azul Tormenta `#A4C5D8`). Every component that reads `--color-primary`/`--color-accent`/`--color-secondary` restyles automatically; the semantic role of `accent` shifts from amber to a green-family tone, so its call sites are reviewed.
- **Typography — placeholder only:** Per the request, do **not** fetch or embed the font files. Establish the token structure for the manual's families (Gotham/Inter for headings + CTAs, Montserrat for subtitles/labels) and leave a clearly named, documented slot (name + path) where the files/`@font-face` declarations get added later. IBM Plex Sans stays as the working fallback until then.
- **Logo — placeholder only:** Per the request, do **not** generate the artwork. Define the asset paths and filenames where the logosímbolo (bull head), wordmark, and full lockup will live (under `public/brand/`), and document which components consume them. The inline "T" box is left in place as the fallback until the real files are dropped in.
- Update the in-app brand wordmark text from "Tauru" to "TAUVO" where it appears as literal copy (navbar, footer, sidebar, auth screens, etc.).

## Capabilities

### New Capabilities
- `brand-identity`: The visual brand system of the product — corporate color tokens, the typography token structure and where font files are wired in, and the logo asset contract (filenames, paths, and which UI surfaces consume each variant).

### Modified Capabilities
<!-- None. Colors, fonts, and logo are presentation concerns; no existing capability's behavioral requirements change. -->

## Impact

- **Concrete edits:** [src/styles.css](src/styles.css) (color tokens applied; font tokens + documented placeholder slot; utility classes reviewed for the amber→green accent shift).
- **Brand text:** ~9 components carrying the literal "Tauru" wordmark and the inline "T" box ([navbar](src/app/shared/components/navbar/navbar-component.ts), [footer](src/app/shared/components/footer/footer.ts), [sidebar](src/app/shared/components/sidebar/sidebar.component.ts), and the `features/auth/*` screens).
- **Placeholders (no binaries added):** a new `public/brand/` location for logo files, and a documented font slot in `styles.css`. Both are wired structurally so that dropping the real assets in later needs no further code changes.
- **Out of scope:** producing the actual logo SVG/PNG artwork and the licensed font files — those are supplied separately by the brand owner and added at the documented paths.
