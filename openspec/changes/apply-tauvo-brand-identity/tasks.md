## 1. Color tokens (concrete)

- [x] 1.1 In [src/styles.css](src/styles.css) `@theme`, replace the primary tokens: `--color-primary: #1B7A3F`, `--color-primary-dark: #0D4A26`, `--color-primary-light: #E6F4EC`
- [x] 1.2 Replace the secondary tokens: `--color-secondary: #4CAF7D`, `--color-secondary-dark: #1B7A3F`, and `--color-secondary-light` as a light tint
- [x] 1.3 Replace the accent tokens: `--color-accent: #4CAF7D`, `--color-accent-dark: #1B7A3F`, `--color-accent-light` as a light tint (removing amber `#f59e0b`/`#d97706`)
- [x] 1.4 Set dark/footer tokens to Negro Corporativo `#1A1A1A` (`--color-dark`, `--color-footer`) and confirm `--color-card: #FFFFFF`
- [x] 1.5 Add optional `--color-support: #A4C5D8` (Azul Tormenta) for cool contrast/info, and set the body text color (html/body) toward Carbón `#2D2D2D`
- [x] 1.6 In `@layer utilities`, switch `.btn-accent` and `.badge-accent` foreground from `text-white` to dark text (`#2D2D2D`) per the accent-contrast decision; review `.btn-secondary`/`.badge-secondary`

## 2. Purge legacy hard-coded values

- [x] 2.1 Grep the codebase for stray legacy hexes (`#060d1a`, `#003585`, `#f59e0b`, `#d97706`, `#00bf63`) used inline instead of tokens and replace with the semantic class or new token
- [x] 2.2 Review accent call sites specifically (the become-seller CTA gradient, badges) so the amber→green shift reads well

## 3. Brand wordmark text

- [x] 3.1 Update the literal "Tauru" wordmark to "TAUVO" in the navbar, footer, and sidebar
- [x] 3.2 Update the literal "Tauru" wordmark to "TAUVO" across the `features/auth/*` screens and any other component listing (profile, become-seller, marketplace-settings)

## 4. Font placeholder (structure only — no files)

- [x] 4.1 In [src/styles.css](src/styles.css), define `--font-family-heading: 'Gotham','Inter','IBM Plex Sans',sans-serif` and `--font-family-sans: 'Montserrat','IBM Plex Sans',sans-serif`, keeping the IBM Plex `@import` as fallback
- [x] 4.2 Add a single commented `@font-face` slot block naming the expected files and path (`public/brand/fonts/Gotham-Bold.woff2`, `Montserrat-Medium.woff2`) and the exact lines to uncomment once the licensed files are added — add NO font binaries in this change
- [x] 4.3 Apply `--font-family-heading` to headings/CTAs where appropriate (or leave a documented note if deferring), without breaking the IBM Plex fallback

## 5. Logo asset contract (paths only — no artwork)

- [x] 5.1 Create `public/brand/README.md` listing the expected filenames and paths: `tauvo-lockup.svg`, `tauvo-lockup-white.svg`, `tauvo-wordmark.svg`, `tauvo-logosimbolo.svg`, plus the `public/brand/fonts/` note
- [x] 5.2 In the README, document which component consumes each variant (navbar → wordmark/lockup, footer → white lockup on dark, sidebar → logosímbolo, auth screens → lockup, favicon → logosímbolo 32×32)
- [x] 5.3 Add a one-line comment at each consuming component (navbar, footer, sidebar, auth screens) pointing to its `/brand/…` asset path, leaving the inline "T" box in place as the fallback so nothing 404s — do NOT add image files or swap `<img>` in this change

## 6. Verify

- [x] 6.1 `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` pass
- [x] 6.2 Run the app and confirm primary/secondary/accent render as TAUVO greens with no amber, accent buttons are legible, and the wordmark reads "TAUVO"
- [x] 6.3 Confirm the app still runs with no font/logo binaries present (IBM Plex + "T" box fallback), and that the font slot and `public/brand/README.md` clearly name where the real assets go
