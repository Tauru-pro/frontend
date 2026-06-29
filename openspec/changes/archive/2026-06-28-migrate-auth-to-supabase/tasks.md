> Secciones 1-4: el proyecto Supabase real (`tauru-pro`, ref `egumzigrxcyrnbfaeewg`)
> ya existe; con credenciales que el usuario proveyó se aplicaron las 4
> migraciones SQL, se activó el Auth Hook, se desplegó `admin-create-user`,
> y se sembró el `SUPER_ADMIN` por defecto. Quedan sin marcar solo lo que
> requiere acceso externo que no se tiene en este entorno (Google Cloud
> OAuth client, plan de pago/SMTP propio para plantillas de email) o
> pruebas manuales con un segundo usuario real.

## 1. Supabase project setup

- [x] 1.1 Crear (o designar) el proyecto de Supabase y registrar `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (esta última solo como secreto de Edge Function, nunca en el frontend) — proyecto `egumzigrxcyrnbfaeewg`; `SUPABASE_URL`/anon key ya están en `environment.ts`/`environment.development.ts`; `SUPABASE_SERVICE_ROLE_KEY` es auto-provista a la Edge Function por la plataforma
- [ ] 1.2 Configurar el proveedor Google OAuth en Supabase (client id/secret) y el `redirectTo` (`/auth/callback`) — **bloqueado**: requiere un client id/secret de Google Cloud Console que no se tiene; sí se agregó `http://localhost:4200/auth/callback` al `uri_allow_list` del proyecto
- [ ] 1.3 Configurar las plantillas de email "Confirm signup" e "Invite user" para usar `{{ .Token }}` (código de 6 dígitos) en vez del magic link por defecto — **bloqueado por plan**: la API rechazó el cambio ("Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider")

## 2. Esquema de base de datos y RLS

- [x] 2.1 Crear tabla `profiles` (`id`, `email`, `full_name`, `role` con check `SUPER_ADMIN|ADMIN|SELLER|CUSTOMER`, `status`, `created_at`) — aplicada en producción vía `supabase/migrations/0001_profiles_schema.sql`
- [x] 2.2 Crear tablas `seller_profiles` y `customer_profiles` (renombrando `buyer_profiles` → `customer_profiles`) con FK a `profiles.id` — aplicada en producción
- [x] 2.3 Crear trigger `handle_new_user()` (SECURITY DEFINER) en `auth.users AFTER INSERT` que inserta en `profiles` con `role = 'CUSTOMER'` siempre, ignorando metadata del cliente — aplicada en producción, verificado: invitar/registrar crea el perfil correctamente
- [x] 2.4 Crear la función/Auth Hook `custom_access_token_hook` que inyecta `user_role` en el JWT a partir de `profiles.role`, y habilitarla en la configuración de Auth del proyecto — función aplicada y hook **activado** vía Management API (`hook_custom_access_token_enabled: true`)
- [x] 2.5 Escribir políticas RLS en `profiles`: auto-lectura/auto-edición de campos no sensibles (`auth.uid() = id`), lectura/escritura total para `(auth.jwt() ->> 'user_role') = 'SUPER_ADMIN'`, sin política de INSERT pública (solo vía trigger/Edge Function) — aplicada en producción, políticas confirmadas vía `pg_policies`
- [x] 2.6 Agregar trigger/check que impida a un usuario no-`SUPER_ADMIN` modificar su propio `role`/`status` — aplicada; **bug encontrado y corregido**: el trigger original bloqueaba también al `service_role` (las RLS se bypassan pero los triggers no), lo que rompía tanto el seed script como la Edge Function al promover un rol. Se agregó `if current_user = 'service_role' then return new; end if;` al inicio de `protect_role_and_status()` — ver `supabase/migrations/0004_rls_policies.sql`
- [ ] 2.7 Probar manualmente las políticas: usuario `CUSTOMER` no puede leer el perfil de otro `id`; `SUPER_ADMIN` puede leer todos — pendiente: no hay todavía un segundo usuario `CUSTOMER` confirmado contra el cual probar el aislamiento

## 3. Edge Function para creación de usuarios privilegiados

- [x] 3.1 Crear la Edge Function `admin-create-user` que valida `user_role === 'SUPER_ADMIN'` desde el JWT del caller — **desplegada** (`supabase functions deploy admin-create-user`)
- [x] 3.2 Dentro de la función, usar un cliente con `service_role` para `inviteUserByEmail(email, { data: { full_name, role } })`
- [x] 3.3 Tras la invitación, actualizar `profiles.role` al rol solicitado (`SELLER` o `SUPER_ADMIN`) usando el cliente `service_role`
- [x] 3.4 Probar la función rechazando llamadas de un caller que no sea `SUPER_ADMIN` (curl/Postman directo a la función, sin pasar por la UI) — probado: sin `Authorization` → 401; con un JWT inválido → 401. No se probó el caso "JWT válido pero rol distinto de SUPER_ADMIN" por falta de un segundo usuario confirmado

## 4. Aprovisionamiento del SUPER_ADMIN por defecto

- [x] 4.1 Escribir `scripts/seed-super-admin.ts` (fuera del build de Angular) que usa `service_role` para crear/invitar al usuario `SUPER_ADMIN` por defecto y fijar su rol
- [x] 4.2 Ejecutar el script contra el proyecto de Supabase y verificar que el usuario puede iniciar sesión — `deimerhdz21@gmail.com` invitado y promovido a `SUPER_ADMIN` (`status: ACTIVE`); falta que el usuario confirme la invitación por correo y haga login para validar el último paso end-to-end

## 5. Dependencias y configuración del frontend

- [x] 5.1 Agregar `@supabase/supabase-js` a `package.json`
- [x] 5.2 Agregar `supabase: { url, anonKey }` a `environment.ts` y `environment.development.ts` — valores reales del proyecto, no placeholders
- [x] 5.3 Crear `core/auth/supabase-client.ts` que expone el cliente Supabase, con `persistSession`/`detectSessionInUrl` activos solo en `isPlatformBrowser`

## 6. Modelo de datos y roles

- [x] 6.1 Actualizar `UserRole` en `core/models/user.model.ts` a `'SUPER_ADMIN' | 'ADMIN' | 'SELLER' | 'CUSTOMER'`
- [x] 6.2 Renombrar `BuyerProfile` → `CustomerProfile` y el campo `buyerProfile` → `customerProfile` en `UserProfile`, y actualizar todos los usos (buscar `Buyer`/`BUYER` en todo el repo)
- [x] 6.3 Actualizar `CreateUserDto`/`UpdateUserDto` si aplica

## 7. AuthService (Supabase Auth)

- [x] 7.1 Reescribir `register()` para usar `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- [x] 7.2 Reescribir `verifyEmail(code)` con `supabase.auth.verifyOtp({ email, token: code, type: 'signup' })` y `resendCode()` con `supabase.auth.resend({ type: 'signup', email })`
- [x] 7.3 Reescribir `login()` con `supabase.auth.signInWithPassword()`, manejando solo el caso "email no confirmado"; eliminar las ramas de MFA/TOTP y "nueva contraseña requerida"
- [x] 7.4 Reescribir `signInWithGoogle()` con `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
- [x] 7.5 Reescribir `logout()` con `supabase.auth.signOut()` y limpieza del `UserStore`
- [x] 7.6 Reescribir `loadCurrentUser()` usando `supabase.auth.getSession()`/`getUser()`; cambiar el tipo del signal `currentUser` al `User` de `@supabase/supabase-js`
- [x] 7.7 Reemplazar el listener `Hub.listen('auth', ...)` por `supabase.auth.onAuthStateChange(...)` para refrescar `UserStore` tras login/OAuth
- [x] 7.8 Simplificar `getErrorMessage()` para mapear mensajes de `AuthError` de Supabase en vez de excepciones de Cognito

## 8. UserStore y UserService

- [x] 8.1 Reescribir `UserStore.loadUser()` para consultar `supabase.from('profiles').select('*, seller_profiles(*), customer_profiles(*)').eq('id', user.id).single()` en vez de `GET /auth/me`
- [x] 8.2 Reescribir `UserService.getUsers(page, limit)` usando `.select('*', { count: 'exact' }).range(...)`, devolviendo el mismo `PaginatedResponse<UserProfile>` (calculando `totalPages` en el cliente)
- [x] 8.3 Reescribir `UserService.createUser(dto)` para invocar `supabase.functions.invoke('admin-create-user', { body: dto })` en vez de `POST /admin/users/create`
- [x] 8.4 Eliminar o adaptar `UserService.getSellers()` si sigue siendo necesario fuera de este cambio — sigue siendo usado por `sellers.component.ts` (fuera de alcance), se deja sin cambios sobre `HttpClient`

## 9. Guards e interceptor

- [x] 9.1 Actualizar `authGuard` para usar la sesión de Supabase (`supabase.auth.getSession()`) en vez de `authService.loadCurrentUser()` basado en Cognito
- [x] 9.2 Actualizar `adminGuard` para aceptar `['ADMIN', 'SUPER_ADMIN']`
- [x] 9.3 Crear `superAdminGuard` (`role === 'SUPER_ADMIN'`) y aplicarlo a las rutas `users`/`users/new` en `backoffice-routes.ts`
- [x] 9.4 Reescribir `auth.interceptor.ts` para adjuntar `supabaseClient.auth.getSession()` → `session.access_token` como Bearer en llamadas `HttpClient` (sigue siendo necesario para los dominios que aún usan el backend legacy)

## 10. Vistas de autenticación

- [x] 10.1 Simplificar `sign-in.component.ts`: quitar los pasos `new_password`/`mfa`, conservar el flujo de credenciales + Google + redirección a verificación si el email no está confirmado
- [x] 10.2 Actualizar `sign-up.component.ts` para llamar al `register()` reescrito (sin selector de rol visible; siempre `CUSTOMER`)
- [x] 10.3 Actualizar `verify-email.component.ts` para el nuevo `verifyEmail`/`resendCode` — sin cambios necesarios, la firma de `AuthService` ya es compatible
- [x] 10.4 Actualizar `callback.component.ts` para el flujo de `onAuthStateChange`/`getSession()` de Supabase tras el redirect de Google

## 11. Vistas de administración de usuarios (SUPER_ADMIN)

- [x] 11.1 Actualizar `users.component.ts`: mapas de rol/estado para incluir `SUPER_ADMIN` y `CUSTOMER` (renombrado de `BUYER`), usar `customerProfile` en vez de `buyerProfile`
- [x] 11.2 Actualizar `user-form.component.ts`: el selector de rol solo ofrece `SELLER` y `SUPER_ADMIN` (no `CUSTOMER`, no `ADMIN`)
- [x] 11.3 Aplicar `superAdminGuard` en las rutas correspondientes dentro de `backoffice-routes.ts`

## 12. Limpieza de Cognito/Amplify

- [x] 12.1 Quitar `aws-amplify` de `package.json` y `app.config.ts`/`app.config.server.ts`
- [x] 12.2 Eliminar `core/config/cognito.config.ts` y las claves `cognito` de `environment.ts`/`environment.development.ts`
- [x] 12.3 Actualizar `app.config.ts` para inicializar el cliente de Supabase en vez de `Amplify.configure()`, preservando el orden de bloqueo del router hasta que `loadCurrentUser()`/`loadUser()` resuelvan

## 13. Verificación manual

> Bloqueada hasta que las secciones 1, 2.7, 3.4 y 4.2 se ejecuten contra un
> proyecto Supabase real. Checklist detallado en `supabase/README.md`.

- [ ] 13.1 Registro `CUSTOMER` + verificación por código + login
- [ ] 13.2 Login con Google OAuth de extremo a extremo
- [ ] 13.3 Login como `SUPER_ADMIN` por defecto, navegar a `/admin/users`, listar con paginación
- [ ] 13.4 Crear un `SELLER` y un `SUPER_ADMIN` desde `/admin/users/new`, confirmar el correo de invitación y el rol asignado
- [ ] 13.5 Confirmar que un `ADMIN` no puede acceder a `/admin/users` ni `/admin/users/new`
- [ ] 13.6 Confirmar que dominios fuera de alcance (bulls, supplies, branches, etc.) siguen funcionando con el interceptor reescrito
