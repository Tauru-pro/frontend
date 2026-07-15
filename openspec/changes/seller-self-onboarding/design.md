## Context

Stack: Angular 21 SSR standalone + Supabase (Auth/Postgres/RLS/Edge Functions). Roles viven en `profiles.role` (`SUPER_ADMIN`>`ADMIN`>`SELLER`>`CUSTOMER`). El claim `user_role` (y `tenant_id`) se inyecta en el JWT por `custom_access_token_hook` en cada emisión/refresh ([0006_seller_tenant_identity.sql](supabase/migrations/0006_seller_tenant_identity.sql)). `seller_profiles` y `customer_profiles` ya existen ([0001_profiles_schema.sql](supabase/migrations/0001_profiles_schema.sql)); `seller_profiles` tiene `unique(user_id)` y soporta upsert-on-first-save, con RLS de dueño + lectura admin.

Restricción clave: el trigger `protect_role_and_status` ([0004_rls_policies.sql:31-57](supabase/migrations/0004_rls_policies.sql#L31-L57)) sólo deja cambiar `role`/`status` a `service_role` o a un JWT `SUPER_ADMIN`. Un `CUSTOMER` **no** puede auto-promoverse. Ya existe el patrón de Edge Function con `service_role` en [admin-create-user](supabase/functions/admin-create-user/index.ts). El frontend escribe directo a Supabase con supabase-js (p.ej. [breed.service.ts](src/app/core/services/breed.service.ts)); la sesión se maneja en [auth.service.ts](src/app/core/auth/auth.service.ts) + [user.store.ts](src/app/core/store/user.store.ts).

## Goals / Non-Goals

**Goals:**
- Onboarding self-service `CUSTOMER`→`SELLER` con buena UX (wizard multi-paso, validación por paso, sin perder datos al retroceder). El indicador de progreso se retiró tras la implementación: aportaba poco frente al espacio que ocupaba.
- Encuesta de segmentación 100% definida por el `SUPER_ADMIN` (dinámica).
- Promoción de rol atómica y segura (imposible de falsificar desde el cliente).
- T&C de comprador (en registro) y de proveedor (al final del wizard) con aceptación registrada.

**Non-Goals:**
- Aprobación manual del proveedor por un admin antes de activar el rol (el rol cambia de inmediato; `seller_profiles.status='PENDING'` queda para verificación posterior de listings).
- Editor de contenido enriquecido de los T&C ni versionado avanzado (MVP: documento "vigente" por audiencia).
- Planes/pagos; edición de respuestas de encuesta ya enviadas.

## Decisions

- **Promoción de rol vía Edge Function `seller-self-onboard` (service_role), no RPC ni update directo.** El wizard llama `supabase.functions.invoke('seller-self-onboard', { body })` con el JWT del `CUSTOMER`. La función: valida el claim del llamador (rol `CUSTOMER`, sesión válida), valida el payload (datos de empresa, respuestas requeridas de la encuesta activa, aceptación de T&C de proveedor), y en un solo flujo con `service_role`: upsert `seller_profiles`, insert `seller_onboarding_responses`, insert `terms_acceptances(audience='SELLER')`, y `update profiles set role='SELLER'`. Es el único camino que atraviesa el trigger `protect_role_and_status`. Alternativa (SECURITY DEFINER RPC) descartada: replicaría lógica de validación en plpgsql y es más frágil que reusar el patrón de Edge Function ya probado.
- **Atomicidad.** Preferir que la Edge Function ejecute las escrituras vía una función Postgres transaccional (`security definer`) o en orden con verificación, de modo que si el `update role` falla no queden respuestas huérfanas ni rol a medias. Registrar respuestas/consent y promover en la misma unidad lógica.
- **Refresh de sesión tras promover.** Como el rol nuevo sólo entra al JWT en la próxima emisión, tras el `invoke` exitoso el cliente hace `supabase.auth.refreshSession()` → recarga `UserStore` → navega al panel `SELLER`. (Mismo principio que el hook: el claim se recalcula al refrescar.)
- **Modelo de encuesta dinámica.** Nuevas tablas:
  - `onboarding_survey_questions(id, prompt, input_type check in ('SINGLE_CHOICE','MULTI_CHOICE','TEXT','NUMBER'), options jsonb, position int, is_required bool, is_active bool, created_at)`.
  - `seller_onboarding_responses(id, user_id fk profiles, question_id fk questions, answer jsonb, created_at)`.
  RLS: `questions` lectura para autenticados (render del wizard), escritura sólo `SUPER_ADMIN`; `responses` dueño lee lo suyo, `ADMIN`/`SUPER_ADMIN` leen todo; el insert de respuestas lo hace la Edge Function (service_role).
- **T&C.** `terms_documents(id, audience check in ('BUYER','SELLER'), version, content, is_current bool, published_at)` + `terms_acceptances(id, user_id, audience, version, accepted_at)`. Lectura pública del documento vigente; `terms_acceptances` dueño lee lo suyo. Aceptación de comprador se registra en el sign-up; la de proveedor en la Edge Function.
- **Rutas y guards (frontend).** Onboarding bajo el marketplace (layout público con sesión), p.ej. `''`→`join-as-seller`/`onboarding`, protegido por un guard "customer autenticado, no seller" (si es `SELLER` redirige al panel; si no hay sesión, manda a sign-up y retorna). Reusar `sellerGuard`/`user.store` como referencia. Perfil de comprador como ruta autenticada del marketplace. Gestión de encuesta en el backoffice ([backoffice-routes.ts](src/app/features/backoffice/backoffice-routes.ts)) protegida por `superAdminGuard`, reusando `data-table`/formularios existentes y el enum `RoutesApp`.
- **Reuso de UI.** Wizard con signals locales por paso (patrón de componentes standalone OnPush); datos de empresa reusan los campos y el servicio de `seller_profiles` que ya usa [seller-settings.component.ts](src/app/features/seller/settings/seller-settings.component.ts). La ubicación reusa [location-select.component.ts](src/app/shared/components/location-select/location-select.component.ts) (Departamento→Municipio contra el catálogo de geografía), igual que seller-settings y branch-form, en vez de texto libre. CTA con `HasRoleDirective` en [navbar-component.ts](src/app/shared/components/navbar/navbar-component.ts) y en el footer.
- **Campos retirados de `seller_profiles`.** `country` y `business_hours` (añadidos en 0006) se eliminan en 0012: el marketplace es sólo Colombia y el horario operativo pertenece a cada sucursal (`branches.business_hours`, 0007), no a la tienda. `seller_profiles.city_id` pasa a tener FK real contra `cities`, lo que además habilita el embed `cities(...)` de PostgREST que usan `seller.service` y `UserStore`.

## Risks / Trade-offs

- [Promoción parcial / estado corrupto] → Ejecutar las escrituras dentro de una función Postgres transaccional invocada por la Edge Function (o verificar y hacer rollback lógico); nunca promover el rol antes de persistir respuestas y consentimiento.
- [El usuario no ve el rol nuevo tras terminar] → `refreshSession()` obligatorio antes de redirigir; si falla el refresh, forzar re-login. Reusa el aprendizaje del hook (`custom_access_token_hook`) que ya está activo.
- [Encuesta editada mientras hay onboardings en curso] → Guardar `question_id` + snapshot del `prompt`/opciones en la respuesta para no perder contexto si el super admin cambia la pregunta después.
- [Edge Function no puede fijar secrets `SUPABASE_*`] → Se auto-inyectan en el runtime (como en `admin-create-user`); no requiere `secrets set`.
- [Doble envío / reintentos] → Idempotencia por `unique(user_id)` en `seller_profiles` (upsert) y por chequeo de rol actual (`CUSTOMER`) al entrar a la función.

## Migration Plan

1. Migración SQL nueva con las 4 tablas + RLS + (opcional) función transaccional `submit_seller_onboarding`. `supabase db push`.
2. Desplegar Edge Function `seller-self-onboard`.
3. Seed inicial: 1 `terms_documents` vigente por audiencia (BUYER/SELLER) y algunas preguntas de encuesta de ejemplo (o dejar que el super admin las cree).
4. Frontend: rutas/guards/servicios/wizard/perfil/CTA/checkbox de T&C en sign-up.
5. Rollback: las capacidades son aditivas; revertir migración/función y ocultar rutas no afecta compra ni el panel actual.

## Open Questions

- ¿Los datos de "empresa" alimentan `seller_profiles` (reutilizar tal cual) o requieren campos nuevos (NIT/razón social)? — asumido: reutilizar `seller_profiles` (+ columnas menores si faltan).
- ¿La encuesta debe poder segmentar automáticamente (`customer_profiles.buyer_type`) o sólo almacenar respuestas para análisis? — asumido: sólo almacenar (MVP); mapeo a `buyer_type` opcional posterior.
- ¿Contenido de T&C es estático seedeado o gestionable por super admin? — asumido: documento vigente seedeado; gestión por admin fuera de alcance del MVP.
