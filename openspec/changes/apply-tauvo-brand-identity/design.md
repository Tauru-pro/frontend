## Context

Styling is centralized: Tailwind v4 reads CSS custom properties from the `@theme` block in [src/styles.css](src/styles.css) (there is no `tailwind.config.js`). Components consume **semantic** classes (`bg-primary`, `text-accent`, `btn-primary`, `badge-accent`, …) defined once in `@layer utilities`, so retokenizing `styles.css` restyles the whole app without touching component templates — except where a brand value is hard-coded inline (the "T" logo box and the literal "Tauru" wordmark, present in ~9 components).

Today's tokens are the legacy "Tauru" identity: cobalt-blue primary (`#060d1a`/`#003585`), a green secondary (`#00bf63`), and an amber accent (`#f59e0b`). The Manual de Identidad TAUVO defines a green-led, near-monochrome brand: three greens, black, charcoal, white, and one cool support blue (Azul Tormenta) — **no amber**. Fonts move from IBM Plex Sans to Gotham/Inter (headings/CTAs) + Montserrat (subtitles/labels). The logo becomes a real bull-head lockup instead of an inline "T".

Per the request, this change applies **colors** concretely but treats **fonts and the logo as placeholders** — structure + documented name/path only, no binaries.

## Goals / Non-Goals

**Goals:**
- Retokenize `styles.css` `@theme` to the TAUVO palette so the app renders on-brand end to end.
- Resolve the amber→green accent shift coherently and accessibly.
- Establish a named, documented slot for the brand fonts and a `public/brand/` asset contract for the logo, wired so that dropping real files in later needs no code changes.
- Update literal "Tauru" copy to "TAUVO".

**Non-Goals:**
- Producing the logo artwork (SVG/PNG) or shipping the licensed Gotham/Montserrat font files — supplied separately by the brand owner.
- Dark-mode theming, redesigning component layouts, or touching behavior/specs of any feature.
- Replacing `favicon.ico` artwork (only documented as a follow-up slot).

## Decisions

### Color token mapping (applied)

| Token | New value | Manual name |
|---|---|---|
| `--color-primary` | `#1B7A3F` | Verde Primario |
| `--color-primary-dark` | `#0D4A26` | Verde Oscuro |
| `--color-primary-light` | `#E6F4EC` | (tint of primary, for `*-light` surfaces) |
| `--color-secondary` | `#4CAF7D` | Verde Claro |
| `--color-secondary-dark` | `#1B7A3F` | Verde Primario |
| `--color-accent` | `#4CAF7D` | Verde Claro (see accent decision) |
| `--color-accent-dark` | `#1B7A3F` | Verde Primario |
| `--color-support` (new, optional) | `#A4C5D8` | Azul Tormenta — cool contrast/info only |
| `--color-dark` / `--color-footer` | `#1A1A1A` | Negro Corporativo |
| `--color-card` | `#FFFFFF` | Blanco |
| body text | `#2D2D2D` | Carbón Tipográfico |

### The amber accent becomes green — with dark text on accent

The manual has no vivid non-green pop color, so a distinct "accent" hue no longer exists. Rather than collapse `accent` into `primary` (which would erase the visual difference between `btn-primary` and `btn-accent`), keep `accent` as **Verde Claro** and switch `.btn-accent`/`.badge-accent` foreground from white to **Carbón `#2D2D2D`**. White text on `#4CAF7D` is below the WCAG AA 4.5:1 threshold; dark text on it passes and reads as a lighter, softer green button — a coherent hierarchy against the darker primary green. This is the one change that isn't purely a token swap, so accent call sites (the become-seller CTA, badges) get a visual pass.

### Fonts — token structure + documented slot, IBM Plex as fallback

Restructure the font tokens to name the brand families while keeping the app working before the files exist:
- `--font-family-heading: 'Gotham', 'Inter', 'IBM Plex Sans', sans-serif;`
- `--font-family-sans: 'Montserrat', 'IBM Plex Sans', sans-serif;`

The IBM Plex `@import` stays until the licensed files land, so text never breaks. Add one commented `@font-face` slot block in `styles.css` naming the expected files and path (`public/brand/fonts/` → e.g. `Gotham-Bold.woff2`, `Montserrat-Medium.woff2`) and the exact lines to uncomment. No font files are added now.

### Logo — `public/brand/` contract, inline "T" stays as fallback

`public/` is the Angular asset root (served at `/`). Define the logo contract under `public/brand/`:
- `public/brand/tauvo-lockup.svg` — símbolo + wordmark + tagline (light backgrounds)
- `public/brand/tauvo-lockup-white.svg` — negative version (dark/green backgrounds)
- `public/brand/tauvo-wordmark.svg` — "TAUVO" only
- `public/brand/tauvo-logosimbolo.svg` — bull head only (avatars, favicon, tight spaces)

Consuming surfaces (documented, not yet swapped): navbar → wordmark/lockup; footer → white lockup on `#1A1A1A`; sidebar → logosímbolo; auth screens → lockup; favicon → logosímbolo 32×32. Deliver the contract as `public/brand/README.md` listing the filenames + which component consumes each, plus a one-line comment at each consuming component pointing to its asset path. The inline "T" box is left untouched so nothing 404s; swapping to `<img src="/brand/…">` happens when the files exist and needs no other change.

## Risks / Trade-offs

- **Accent contrast:** dark-on-light-green accent buttons are a deliberate departure from the old white-on-amber. If product prefers white text, accent must instead collapse into the primary green — flagged for the visual review.
- **Near-monochrome palette:** primary, secondary, and accent are all greens; states that relied on hue contrast (e.g. success vs CTA) now differ mainly by lightness. Azul Tormenta (`--color-support`) is available where a genuinely different hue is needed.
- **Placeholder drift:** until the fonts and logo files are delivered, the app runs on IBM Plex + the "T" box, so it will look "half-rebranded". This is intentional per the request; the documented slots keep the final step mechanical.
- **Hard-coded values:** any component using a literal hex instead of a token won't pick up the new palette. The implementation sweeps for stray legacy hexes (`#060d1a`, `#f59e0b`, `#00bf63`).
