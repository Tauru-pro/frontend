# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tauru — an Angular 21 SSR e-commerce marketplace for cattle genetics (bulls/semen straws). Buyers browse a public catalog and checkout; sellers manage their own bulls/supplies/branches; admins manage marketplace-wide settings (breeds, pickup points, shipping rates, users). Auth is AWS Cognito via `aws-amplify`.

## Commands

```bash
npm start                # ng serve — dev server at http://localhost:4200
npm run build            # ng build (SSR, production config by default)
npm run watch            # ng build --watch --configuration development
npm test                 # ng test — runs Vitest via @angular/build:unit-test
npm run serve:ssr:frontend  # run the built SSR server (node dist/frontend/server/server.mjs)
```

- Run a single test file: `ng test -- src/app/path/to/file.spec.ts` (Vitest under the hood).
- There is no e2e setup and only one `*.spec.ts` exists today (`app.spec.ts`) — most features have no tests yet.
- No separate lint script is configured in `package.json`; Prettier config (singleQuote, printWidth 100, Angular HTML parser) lives in `package.json`.

## Architecture

### Route composition (lazy-loaded by area)

`app.routes.ts` mounts four top-level areas, each wrapped in a layout component and lazy-loaded via `loadChildren` pointing at a `default`-exported `Routes` array:

- `''` → `HomeLayoutComponent` → `features/marketplace/marketplace-routes` (public storefront)
- `'auth'` → `HomeLayoutComponent` → `features/auth/auth-routes`
- `'admin'` → `BackofficeLayoutComponent`, guarded by `adminGuard` → `features/backoffice/backoffice-routes`
- `'seller'` → `BackofficeLayoutComponent`, guarded by `sellerGuard` → `features/seller/seller-routes`

Each feature's `*-routes.ts` file uses `loadComponent: () => import('./x.component')`, relying on that component file having a **default export** (e.g. `export default class BullListComponent`). Sibling `list`/`form` components share one route file (`bulls`, `bulls/new`, `bulls/:id/edit` all point into the `bulls/` folder). Some route paths come from the `RoutesApp` enum in `shared/const/routes.ts` rather than literal strings — check that enum before adding new admin/seller paths.

### Auth flow (Cognito + Amplify + SSR)

- `core/auth/auth.service.ts` wraps `aws-amplify/auth` (`signIn`, `signUp`, `confirmSignIn`, `signInWithRedirect` for Google, etc.) and exposes `currentUser`/`pendingEmail` as signals. It also listens on the Amplify `Hub` for `signInWithRedirect` to refresh user state after an OAuth redirect (`features/auth/callback`).
- `core/store/user.store.ts` (NgRx Signals `signalStore`) holds the backend `UserProfile`/`SellerProfile` fetched from `/auth/me`. `AuthService` and `UserStore` are intentionally separate: `AuthService` talks to Cognito, `UserStore` talks to this app's backend.
- `app.config.ts` configures Amplify inside `provideAppInitializer`, **only in the browser** (`isPlatformBrowser` guard, since Amplify/Cognito session checks don't run during SSR). It synchronously injects `AuthService`/`UserStore` and returns the `loadCurrentUser().then(loadUser)` promise so the router blocks until both resolve — this prevents guards from reading `userStore.user()` before it's populated. Preserve this ordering if you touch app initialization.
- `core/guards/{auth,seller,admin}.guard.ts` all short-circuit to `true` when not running in the browser (no Cognito session on the server), then check `authService.loadCurrentUser()` and, for role-specific guards, `userStore.user()?.role`.
- `core/interceptors/auth.interceptor.ts` attaches the Cognito ID token (`fetchAuthSession()`) as `Authorization: Bearer` on the browser only.

### State: NgRx Signals stores vs. signals-in-components

Global/cross-route state (`CartStore`, `UserStore`) uses `@ngrx/signals` (`signalStore`, `withState`, `withComputed`, `withMethods`, `withHooks`). Local/component state uses plain Angular `signal()`. When extending a store, follow the existing pattern in `core/store/cart.store.ts`:
- Optimistic update → mutate `patchState` immediately → call the backend service → roll back to a captured snapshot in the `catch` and set `error`.
- `CartStore` uses `withHooks({ onInit })` to auto-load on first injection — be aware `inject(CartStore)` anywhere triggers a cart fetch.

### Service / model pairing

Each domain has a matching pair in `core/services/*.service.ts` and `core/models/*.model.ts` (e.g. `bull.service.ts` + `bull.model.ts`). Services are thin `HttpClient` wrappers (`providedIn: 'root'`, base URL `${environment.apiUrl}/<resource>`) returning `Observable`s; stores/components call `firstValueFrom(...)` to use them with `async/await`. DTOs (`CreateXDto`, `UpdateXDto`) live alongside the entity interface in the model file, and list endpoints return `PaginatedResponse<T>` (see `product.model.ts`).

### SSR / rendering

- Hybrid rendering via `@angular/ssr`: `app.routes.server.ts` lists routes that must render with `RenderMode.Server` (anything with a dynamic `:id` segment, or anything not explicitly listed via the `**` catch-all). Routes not listed there default to prerendering — when adding a new `:id`-style edit/detail route, add it here or it'll fail at build/prerender time (see the recent "resolve routes to prerender" fix).
- `app.config.server.ts` merges `app.config.ts` with `provideServerRendering(withRoutes(serverRoutes))`.
- Guards and the Amplify initializer treat server-side as a no-op (`isPlatformBrowser` checks) since Cognito/session state isn't available during SSR.

### Styling / design system

Tailwind v4 via `@tailwindcss/postcss`, configured through CSS `@theme` tokens in `src/styles.css` (no `tailwind.config.js`). Custom semantic colors: `--color-primary` (cobalt/dark navy), `--color-secondary` (green), `--color-accent` (amber), plus `--color-surface`/`--color-card`. Reusable utility classes (`.btn-primary`, `.btn-primary-outline`, `.btn-accent`, `.btn-secondary`, `.form-input`, `.card`, `.nav-link`, `.badge-*`) are defined once in `@layer utilities` — prefer these over ad hoc Tailwind class soup in components. Font is IBM Plex Sans, loaded via Google Fonts `@import`. Shared structural components live in `shared/components/` (`button`, `data-table`, `search-select`, `location-select`, `navbar`, `sidebar`, `footer`); table cell/empty-state templating uses structural directives `TableCellDirective`/`TableEmptyDirective` from `shared/directives`.

### Component conventions

All components are standalone, use `changeDetection: ChangeDetectionStrategy.OnPush`, and prefer `input()`/`output()` signal-based APIs over decorators. Inline templates are the norm (no separate `.html`/`.css` files for most feature components). UI copy is in Spanish — match existing strings' tone/locale when adding new ones.

## Notes for editing this repo

- `.claude.md` (lowercase, repo root) is a legacy planning prompt used to bootstrap the original architecture/design-system decisions; the *actual* implemented design tokens in `src/styles.css` have since diverged from the colors listed there — treat `styles.css` as the source of truth, not that file.
- Deployment target is Netlify (`netlify.toml`, `@netlify/angular-runtime`), publishing `dist/frontend/browser`.
- `environment.ts`/`environment.development.ts` currently both point `apiUrl` at `http://localhost:3000/api/v1` and contain real Cognito pool/client IDs — check with the user before changing these or assuming a deployed API URL exists.
