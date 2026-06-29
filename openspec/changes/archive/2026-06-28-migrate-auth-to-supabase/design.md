## Context

Hoy la identidad vive en AWS Cognito (`aws-amplify/auth`) y el perfil/rol del usuario vive en un backend NestJS propio (`environment.apiUrl`, ya deprecado) detrás de `GET /auth/me`. `AuthService` envuelve Cognito (login con reto personalizado, MFA/TOTP, registro, Google OAuth vía `signInWithRedirect`); `UserStore` (NgRx Signals) carga el perfil del backend. Los guards (`auth`, `admin`, `seller`) y el interceptor (`auth.interceptor.ts`) son no-op en SSR (`isPlatformBrowser`) porque Cognito no tiene sesión en el servidor. La vista `/admin/users` ya existe (lista paginada vía `data-table` + formulario de creación) pero llama al backend deprecado y solo distingue `ADMIN`/`SELLER`/`BUYER`.

Esta migración reemplaza Cognito por Supabase Auth y mueve el almacenamiento de perfil/rol a Postgres de Supabase, eliminando la dependencia del backend para este dominio. El resto de servicios (`bull.service.ts`, etc.) sigue golpeando `environment.apiUrl` sin cambios.

## Goals / Non-Goals

**Goals:**
- Login/registro/sesión vía Supabase Auth (email+password, Google OAuth), con la misma UX de verificación por código de 6 dígitos que existe hoy.
- Rol `SUPER_ADMIN` por encima de `ADMIN`, con un usuario `SUPER_ADMIN` por defecto aprovisionado una sola vez.
- Solo `SUPER_ADMIN` puede crear cuentas `SELLER` y `SUPER_ADMIN` desde la UI; `CUSTOMER` solo se crea vía registro público y siempre con ese rol.
- Listado de usuarios paginado y formulario de creación reconectados a Supabase, reutilizando `data-table` y `PaginatedResponse<T>` sin romper su contrato.
- Ninguna `service_role` key de Supabase se expone en el bundle del navegador.

**Non-Goals:**
- No se migran datos de usuarios reales de Cognito a Supabase (ver Open Questions).
- No se reimplementa MFA/TOTP ni el flujo de "nueva contraseña requerida" de Cognito.
- No se tocan los dominios de catálogo/carrito/checkout/supplies/branches/settings, que siguen usando el backend legacy vía `HttpClient`.
- No se diseña edición de usuarios existentes (cambio de rol/estado) más allá de lo que ya soporta `UpdateUserDto`; esta migración cubre listar + crear.

## Decisions

### 1. Cliente Supabase único, sin helpers SSR
Se usa `@supabase/supabase-js` (`createClient`) directamente, sin `@supabase/ssr` (pensado para frameworks con cookies first-class como Next.js). El cliente se crea en un servicio `core/auth/supabase-client.ts` con `persistSession`/`detectSessionInUrl` activados solo cuando `isPlatformBrowser`. En SSR el cliente se crea sin persistencia y las llamadas de auth no se ejecutan — exactamente el mismo patrón que ya usan los guards con Cognito hoy (`isPlatformBrowser` → `return true`). Esto evita introducir manejo de cookies/SSR de sesión nuevo y mantiene el comportamiento actual: páginas SSR no personalizadas por sesión, hidratación en cliente resuelve el estado real.
- Alternativa descartada: sincronizar la sesión de Supabase a una cookie propia para SSR. Más correcto para SEO/personalización server-side, pero es trabajo adicional no pedido y los guards ya asumen "no-op en servidor".

### 2. Rol embebido en el JWT vía Auth Hook, perfil completo en `profiles`
Se separa "identidad" (Supabase Auth, `auth.users`) de "perfil/rol" (tabla `profiles` en el esquema público), igual que hoy se separan `AuthService`/`UserStore`. Para que las políticas RLS puedan filtrar "¿soy SUPER_ADMIN?" sin recursión sobre la propia tabla `profiles`, se usa un **Custom Access Token Auth Hook** (función Postgres `custom_access_token_hook`) que en cada emisión/refresh de token lee `profiles.role` y lo inyecta como claim `user_role` en el JWT. Las políticas RLS y la Edge Function de creación de usuarios leen `auth.jwt() ->> 'user_role'` en vez de hacer `SELECT role FROM profiles WHERE id = auth.uid()` dentro de la propia policy de `profiles` (que causaría recursión).
- Alternativa descartada: política RLS que hace `SELECT role FROM profiles WHERE id = auth.uid()` directamente — funciona para auto-lectura (`auth.uid() = id`) pero falla/recursiona para la policy "SUPER_ADMIN ve todos los perfiles". El hook es el patrón recomendado por Supabase para RBAC.

### 3. Tablas: `profiles`, `seller_profiles`, `customer_profiles`
Se modela 1:1 con las interfaces actuales, renombrando `BuyerProfile` → `CustomerProfile`:
- `profiles(id uuid PK references auth.users(id) on delete cascade, email text, full_name text, role text check (role in ('SUPER_ADMIN','ADMIN','SELLER','CUSTOMER')) default 'CUSTOMER', status text check (status in ('ACTIVE','INACTIVE','SUSPENDED')) default 'ACTIVE', created_at timestamptz default now())`
- `seller_profiles(id uuid PK default gen_random_uuid(), user_id uuid references profiles(id), business_name text, contact_phone text, logo_key text, city_id uuid, address text, status text)`
- `customer_profiles(id uuid PK default gen_random_uuid(), user_id uuid references profiles(id), full_name text, phone text, city_id uuid, herd_size text, buyer_type text, whatsapp text)`

Un trigger `handle_new_user()` (SECURITY DEFINER) en `auth.users AFTER INSERT` crea la fila en `profiles` con `role = 'CUSTOMER'` siempre, ignorando cualquier metadata que el cliente intente enviar en `signUp()`. Esto es lo que garantiza que el registro público nunca pueda auto-asignarse `ADMIN`/`SELLER`/`SUPER_ADMIN`.

### 4. Creación de SELLER/SUPER_ADMIN vía Edge Function (nunca desde el cliente)
Crear un usuario con rol privilegiado requiere `supabase.auth.admin.inviteUserByEmail()`, que solo funciona con la `service_role` key — esa key **nunca** puede vivir en el bundle de Angular. Se implementa una Edge Function `admin-create-user` que:
1. Verifica el JWT del caller (forwardeado automáticamente por `supabase.functions.invoke`) y exige `user_role === 'SUPER_ADMIN'`.
2. Usa un cliente Supabase interno con `service_role` (variable de entorno del proyecto, no del frontend) para llamar `inviteUserByEmail(email, { data: { full_name, role } })`.
3. Actualiza `profiles.role` al rol solicitado (el trigger lo deja en `CUSTOMER` por defecto) con el cliente `service_role`, que bypassa RLS.

El invitado recibe un correo de Supabase para fijar su propia contraseña — se descarta generar/compartir contraseñas temporales manualmente.
- Alternativa descartada: `auth.admin.createUser()` + contraseña temporal compartida por el SUPER_ADMIN — peor UX y riesgo de filtrar contraseñas por canales inseguros (chat, etc.).

### 5. `UserService` mantiene el contrato `PaginatedResponse<T>`
`getUsers(page, limit)` pasa de `HttpClient.get` a `supabase.from('profiles').select('*', { count: 'exact' }).range((page-1)*limit, page*limit-1)`, calculando `totalPages = Math.ceil(count / limit)` en el cliente para devolver el mismo `PaginatedResponse<UserProfile>` que ya consume `UsersComponent`/`data-table`. Así `users.component.ts` no necesita cambios estructurales, solo el origen de los datos cambia dentro del service.

### 6. Solo `SUPER_ADMIN` gestiona usuarios (nuevo guard)
Se agrega `superAdminGuard` (mismo patrón que `adminGuard`/`sellerGuard`) aplicado únicamente a las rutas `admin/users` y `admin/users/new` en `backoffice-routes.ts`. `adminGuard` se actualiza para aceptar `['ADMIN','SUPER_ADMIN']` (el SUPER_ADMIN hereda acceso al resto del backoffice), pero la gestión de usuarios queda exclusiva de `SUPER_ADMIN`.

### 7. `auth.interceptor.ts` se reescribe, no se elimina
Otros dominios (`bull.service.ts`, `supply.service.ts`, etc.) siguen llamando al backend legacy vía `HttpClient` y dependen de un `Authorization: Bearer` header. El interceptor pasa de `fetchAuthSession()` (Cognito) a `supabaseClient.auth.getSession()`, adjuntando `session.access_token`. Las llamadas de auth/usuarios ya no pasan por `HttpClient` (van directo por `supabase-js`), así que el interceptor deja de aplicarles nada, pero sigue siendo necesario para todo lo demás.

### 8. Verificación de email con código de 6 dígitos (no magic link)
Para no romper la UX actual de `verify-email.component.ts`, se configura la plantilla de Supabase "Confirm signup" para usar `{{ .Token }}` (OTP numérico) en vez del link mágico por defecto. `verifyEmail(code)` pasa a `supabase.auth.verifyOtp({ email, token: code, type: 'signup' })`; `resendCode()` pasa a `supabase.auth.resend({ type: 'signup', email })`.

### 9. Sign-in se simplifica (sin MFA/TOTP, sin "nueva contraseña requerida")
Por decisión explícita, se elimina la rama `new_password`/`mfa` de `sign-in.component.ts`. `login()` devuelve directamente sesión válida o error; el único caso especial que se conserva es "email no confirmado" (Supabase devuelve un error identificable) para redirigir a `/auth/verify-email`.

## Risks / Trade-offs

- [SSR no ve la sesión de Supabase, igual que hoy con Cognito] → Sin mitigación nueva necesaria: es el comportamiento actual; no es una regresión.
- [Bug en la Edge Function permitiría escalar privilegios] → La función decide por el claim `user_role` del JWT verificado por Supabase, nunca por un campo del body; la `service_role` key solo existe como secreto de la función, nunca en el frontend.
- [Mala configuración de RLS podría exponer todos los perfiles a cualquier usuario, o bloquear al SUPER_ADMIN] → Usar el patrón de Auth Hook + claim (evita recursión) y agregar una prueba manual de humo antes de salir a producción: iniciar sesión como `CUSTOMER` e intentar leer el perfil de otro `id` (debe devolver 0 filas).
- [Quitar MFA/TOTP es una regresión de seguridad si hay cuentas que ya lo usan] → Confirmar en Open Questions si existen cuentas productivas con MFA antes del corte.
- [Renombrar `BUYER`→`CUSTOMER` y `buyerProfile`→`customerProfile` toca muchos archivos: modelo, guards, switch de rol en sign-in, mapas de rol en `users.component.ts`] → Tratar el rename como una tarea aislada en `tasks.md`, con búsqueda global de `BUYER`/`Buyer` antes y después del cambio.
- [Plan/tier de Supabase podría tener límites de Auth MAU o invocaciones de Edge Functions más bajos de lo esperado] → Ver Open Questions.

## Migration Plan

1. Crear/configurar el proyecto de Supabase: plantillas de email (Token en vez de magic link para signup/recovery), proveedor OAuth de Google con client id/secret.
2. Aplicar migraciones SQL: `profiles`, `seller_profiles`, `customer_profiles`, trigger `handle_new_user`, función/hook `custom_access_token_hook`, políticas RLS (auto-lectura/auto-edición no privilegiada + lectura/escritura total para `SUPER_ADMIN` vía claim).
3. Desplegar la Edge Function `admin-create-user` con la `service_role` key como secreto del proyecto (no del frontend).
4. Ejecutar un script local único (`scripts/seed-super-admin.ts`, fuera del build de Angular) que invita/crea el `SUPER_ADMIN` por defecto y fija su rol.
5. Implementar los cambios de frontend: `core/auth/auth.service.ts`, `core/auth/supabase-client.ts`, `core/store/user.store.ts`, `core/guards/*`, `core/interceptors/auth.interceptor.ts`, `core/models/user.model.ts`, `core/services/user.service.ts`, `app.config.ts`/`app.config.server.ts`, `features/auth/*`, `features/backoffice/users/*`, `environment.ts`/`environment.development.ts` (agregar `supabase: { url, anonKey }`, quitar `cognito`).
6. Probar manualmente: registro `CUSTOMER` + verificación por código, login email/password, login con Google, creación de `SELLER`/`SUPER_ADMIN` desde `/admin/users/new` (solo visible/accesible para `SUPER_ADMIN`), listado paginado, guards (`auth`, `admin`, `seller`, `super-admin`) en cada rol.
7. Una vez validado: quitar `aws-amplify` de `package.json`, eliminar `core/config/cognito.config.ts` y las claves de Cognito de `environment.ts`/`environment.development.ts`.

**Rollback**: si no hay usuarios reales todavía en Supabase al momento de necesitar revertir, basta con revertir el branch/commit del frontend (Cognito sigue intacto mientras no se borren sus recursos). Si ya hay usuarios reales creados en Supabase, este documento no cubre un rollback de datos — habría que exportarlos manualmente antes de revertir.

## Open Questions

- ¿Existen usuarios reales hoy en el user pool de Cognito que deban migrarse, o el entorno actual es solo de desarrollo y se puede partir de cero en Supabase?
- ¿Hay cuentas productivas que dependan hoy de MFA/TOTP? Si las hay, este cambio las afecta (**BREAKING**) y debería coordinarse el corte con esos usuarios.
- ¿Qué plan/tier de Supabase se usará (límites de Auth MAU, invocaciones de Edge Functions, SMTP propio vs. el de Supabase para los correos de invitación/confirmación)?
- ¿El dominio de envío de correo (confirmación, invitación) ya tiene SMTP propio configurado en Supabase, o se usará el remitente compartido por defecto (no recomendado para producción por límites de rate)?
