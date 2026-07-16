# TAUVO — Brand assets

Drop the official logo and font files here. `public/` is the Angular asset root,
so a file at `public/brand/x.svg` is served at `/brand/x.svg`.

Until these files exist, the app falls back to the inline "T" box and IBM Plex
Sans, so nothing 404s. Adding the files below (and swapping the fallbacks) needs
no other code change — the consuming components and the CSS font slot already
point at these paths.

## Logo files (SVG preferred)

| File | Variant | Manual §05 |
|---|---|---|
| `tauvo-lockup.svg` | Símbolo + wordmark + tagline, for light backgrounds | Versión Principal |
| `tauvo-lockup-white.svg` | Negative lockup, for dark / green backgrounds | Versión Negativa |
| `tauvo-wordmark.svg` | "TAUVO" wordmark only | Wordmark |
| `tauvo-logosimbolo.svg` | Bull head only (avatars, favicon, tight spaces) | Logosímbolo |

### Which surface consumes each variant

| Surface | File | Notes |
|---|---|---|
| Navbar ([navbar-component.ts](../../src/app/shared/components/navbar/navbar-component.ts)) | `tauvo-wordmark.svg` (or lockup) | replaces the inline "T" + "TAUVO" text |
| Footer ([footer.ts](../../src/app/shared/components/footer/footer.ts)) | `tauvo-lockup-white.svg` | on Negro `#1A1A1A` background |
| Sidebar / Backoffice ([sidebar.component.ts](../../src/app/shared/components/sidebar/sidebar.component.ts)) | `tauvo-logosimbolo.svg` | compact mark |
| Auth screens (sign-in, sign-up, verify-email, set-password, forgot-password) | `tauvo-lockup.svg` | centered header lockup |
| Favicon (`public/favicon.ico`) | `tauvo-logosimbolo.svg` @ 32×32 | Manual §07 minimum size |

## Fonts

Place the licensed font files under `public/brand/fonts/`:

| File | Family / weight | Usage (Manual §04) |
|---|---|---|
| `Gotham-Bold.woff2` | Gotham Bold | Headings, brand name, CTAs (`--font-family-heading`) |
| `Montserrat-Medium.woff2` | Montserrat Medium | Subtitles, section labels, tagline (`--font-family-sans`) |

Then uncomment the `@font-face` block in [src/styles.css](../../src/styles.css). The
`@theme` font tokens already prefer these families, with IBM Plex Sans as fallback.
