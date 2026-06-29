## Why

La autenticación actual depende de AWS Cognito vía `aws-amplify` y de un backend REST propio (NestJS en `environment.apiUrl`) que ya está deprecado. Con solo los roles `ADMIN`/`SELLER`/`BUYER`, no existe una forma segura de delegar la creación de cuentas `SELLER` o de otros administradores sin acceso directo a la consola de Cognito o a la base de datos del backend. Migrar a Supabase consolida identidad (Auth) y datos de perfil/rol (Postgres) en una sola plataforma, elimina la dependencia del backend deprecado para este dominio, e introduce un rol `SUPER_ADMIN` que puede gestionar usuarios de forma controlada desde la UI.

## What Changes

- Reemplazar AWS Cognito/Amplify por Supabase Auth (email/password + Google OAuth) como proveedor de identidad. **BREAKING**: las sesiones/tokens emitidos por Cognito dejan de ser válidos; todos los usuarios deben volver a autenticarse (o ser recreados) en Supabase.
- Eliminar los flujos de reto personalizado de Cognito (MFA/TOTP, `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED`, SMS code) del `sign-in` actual; no se reimplementan en esta fase. **BREAKING** para cualquier usuario que hoy dependa de MFA/TOTP.
- Agregar el rol `SUPER_ADMIN` por encima de `ADMIN`; renombrar el valor de rol `BUYER` a `CUSTOMER` en el modelo y en la UI. **BREAKING**: cualquier código, query o dato que referencie el rol `BUYER` debe actualizarse.
- Aprovisionar un usuario `SUPER_ADMIN` por defecto mediante un script de seed ejecutado una sola vez contra el proyecto de Supabase (no se distribuye en el bundle de la app).
- El `SUPER_ADMIN` obtiene la capacidad exclusiva de crear cuentas `SELLER` y `SUPER_ADMIN` desde la vista de administración, usando una Supabase Edge Function con la `service_role` key (nunca expuesta en el cliente).
- El registro público (`CUSTOMER`) sigue funcionando desde la página de registro existente, ahora respaldado por Supabase Auth; el rol `CUSTOMER` se asigna siempre del lado del servidor (trigger de base de datos), no es seleccionable por el usuario.
- Las páginas existentes de listado y creación de usuarios (`/admin/users`, `/admin/users/new`) se re-apuntan de la API REST deprecada a consultas directas a Supabase (`@supabase/supabase-js`), manteniendo la UI paginada de `data-table`; el acceso se restringe a `SUPER_ADMIN` mediante un nuevo guard (antes era cualquier `ADMIN`). **BREAKING** para `ADMIN`s que hoy pueden gestionar usuarios.
- `auth.interceptor.ts` se reescribe para adjuntar el access token de sesión de Supabase (en vez del idToken de Cognito) a las llamadas `HttpClient` que aún van al backend legacy de otros dominios; las llamadas de auth y usuarios ya no pasan por `HttpClient` sino por el cliente de Supabase, que gestiona sus propios encabezados.
- Se remueve la dependencia `aws-amplify`; se agrega `@supabase/supabase-js`.
- El backend REST (`environment.apiUrl`) queda deprecado para todo lo cubierto por este cambio (auth y gestión de usuarios); el resto de dominios (bulls, supplies, branches, sellers, pickup points, shipping rates, breeds, settings) no se tocan en este cambio y siguen funcionando como hoy hasta que se migren por separado.

## Capabilities

### New Capabilities
- `supabase-authentication`: inicio/cierre de sesión con email+password y Google OAuth vía Supabase Auth, registro público de `CUSTOMER`, verificación de email, y manejo de sesión en SSR/cliente — reemplaza el flujo de Cognito.
- `super-admin-user-management`: jerarquía de roles (`SUPER_ADMIN` > `ADMIN` > `SELLER` > `CUSTOMER`), aprovisionamiento del `SUPER_ADMIN` por defecto, y la vista de administración para listar usuarios (paginado) y crear nuevos `SELLER`/`SUPER_ADMIN`, restringida a `SUPER_ADMIN`.

### Modified Capabilities
(ninguna — no hay specs existentes de auth/usuarios formalizados en `openspec/specs/` antes de este cambio)

## Impact

- **Código afectado**: `core/auth/auth.service.ts`, `core/store/user.store.ts`, `core/guards/{auth,admin,seller}.guard.ts` (+ nuevo `super-admin.guard.ts`), `core/interceptors/auth.interceptor.ts` (reescrito), `core/models/user.model.ts`, `core/services/user.service.ts`, `core/config/cognito.config.ts` (eliminado) → `core/config/supabase.config.ts`, `app.config.ts`, `app.config.server.ts`, `features/auth/*` (sign-in, sign-up, verify-email, callback), `features/backoffice/users/*`, `shared/const/routes.ts`, `environment.ts` / `environment.development.ts`.
- **Dependencias**: se quita `aws-amplify`; se agrega `@supabase/supabase-js`.
- **Infraestructura nueva (Supabase)**: tabla `profiles` con políticas RLS por rol, trigger en `auth.users` para crear el perfil con rol `CUSTOMER` por defecto al registrarse, y una Edge Function (`service_role`) para la creación de usuarios `SELLER`/`SUPER_ADMIN` desde el panel.
- **Fuera de alcance**: todo lo demás que hoy consume `environment.apiUrl` (catálogo, carrito, checkout, supplies, branches, settings de marketplace) no cambia en este ciclo.
