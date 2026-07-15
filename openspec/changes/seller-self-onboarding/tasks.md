## 1. Base de datos (migraciones + RLS)

- [x] 1.1 Migración: tabla `onboarding_survey_questions` (prompt, input_type CHECK, options jsonb, position, is_required, is_active) + índice por `position`
- [x] 1.2 Migración: tabla `seller_onboarding_responses` (user_id, question_id, answer jsonb, snapshot del prompt/opciones) + índices
- [x] 1.3 Migración: tablas `terms_documents` (audience, version, content, is_current) y `terms_acceptances` (user_id, audience, version, accepted_at)
- [x] 1.4 RLS: questions (lectura autenticados, escritura sólo SUPER_ADMIN); responses (dueño lee lo suyo, ADMIN/SUPER_ADMIN leen todo); terms_documents (lectura del vigente); terms_acceptances (dueño lee lo suyo)
- [x] 1.5 (Opcional recomendado) función `security definer` `submit_seller_onboarding(payload jsonb)` que upsert `seller_profiles`, inserta respuestas + aceptación de T&C de proveedor y promueve `role='SELLER'` de forma atómica
- [x] 1.6 `supabase db push` y verificar en remoto; seed de 1 `terms_documents` vigente por audiencia (BUYER/SELLER)

## 2. Edge Function de promoción segura

- [x] 2.1 Crear `supabase/functions/seller-self-onboard/index.ts` siguiendo el patrón de `admin-create-user` (CORS, verificación de JWT, rechazo si el rol del llamador no es `CUSTOMER`)
- [x] 2.2 Validar payload (datos de empresa, respuestas requeridas de la encuesta activa, aceptación de T&C de proveedor); ejecutar la promoción vía la función transaccional (service_role) y devolver resultado/errores tipados
- [x] 2.3 Desplegar (`supabase functions deploy seller-self-onboard`) y probar: llamador CUSTOMER promociona OK; llamador no-CUSTOMER es rechazado

## 3. Servicios/modelos frontend (core)

- [x] 3.1 `core/models/onboarding-survey.model.ts` + `core/services/onboarding-survey.service.ts` (CRUD questions; leer encuesta activa)
- [x] 3.2 `core/models/terms.model.ts` + `core/services/terms.service.ts` (leer documento vigente por audiencia; registrar aceptación de comprador)
- [x] 3.3 `core/services/seller-onboarding.service.ts` (invoca la Edge Function `seller-self-onboard`, maneja errores y luego `refreshSession()` + recarga `UserStore`)

## 4. Registro de comprador con T&C (supabase-authentication)

- [x] 4.1 En [sign-up.component.ts](src/app/features/auth/sign-up/sign-up.component.ts): checkbox obligatorio de T&C de comprador (bloquea submit) + enlace para ver el documento vigente
- [x] 4.2 Registrar la aceptación (audience `BUYER`, versión vigente) al crear la cuenta

## 5. Perfil de comprador (customer-profile)

- [x] 5.1 Ruta autenticada de perfil en el marketplace + entrada en el menú "Cuenta" del navbar
- [x] 5.2 Página de perfil: ver/editar información personal (nombre, contacto) contra `customer_profiles`/`profiles` (RLS de dueño)
- [x] 5.3 Mostrar en el perfil la CTA "Quiero ser proveedor" para no-sellers

## 6. Wizard de onboarding de proveedor (seller-self-onboarding)

- [x] 6.1 CTA "Unirse como proveedor" visible en [navbar-component.ts](src/app/shared/components/navbar/navbar-component.ts) (oculta para `SELLER`) usando `HasRoleDirective`
- [x] 6.2 Guard "customer autenticado, no seller": sin sesión → sign-up y retorno al flujo; si `SELLER` → redirige al panel
- [x] 6.3 Contenedor del wizard con navegación adelante/atrás y estado por paso (signals), sin perder datos al retroceder (el indicador de progreso se retiró por decisión de producto)
- [x] 6.4 Paso 1 — datos de empresa (reusar campos/servicio de `seller_profiles` como en [seller-settings.component.ts](src/app/features/seller/settings/seller-settings.component.ts)), con validación; ubicación vía `<app-location-select>` (Departamento/Municipio del catálogo de geografía), sin país ni horario
- [x] 6.5 Paso 2 — render dinámico de la encuesta activa (single/multi/text/number), validación de requeridas
- [x] 6.6 Paso 3 — mostrar y aceptar T&C de proveedor (checkbox obligatorio)
- [x] 6.7 Envío: invocar `seller-onboarding.service` → refresh de sesión → recargar `UserStore` → redirigir al panel `SELLER`; manejo de error sin promoción parcial

## 7. Gestión de la encuesta (onboarding-survey-management)

- [x] 7.1 Ruta en el backoffice protegida por `superAdminGuard` (añadir a `RoutesApp` + [backoffice-routes.ts](src/app/features/backoffice/backoffice-routes.ts))
- [x] 7.2 Lista de preguntas con `data-table` (orden, tipo, requerida, activa) + acciones
- [x] 7.3 Formulario crear/editar pregunta (prompt, tipo, opciones para choice, requerida, activa) + reordenar

## 8. Verificación end-to-end

- [x] 8.1 `npm run build` sin errores
- [x] 8.2 Super admin crea/activa preguntas de encuesta; se ven en el wizard en el orden configurado
- [x] 8.3 Visitante sin cuenta → CTA → crea cuenta comprador (acepta T&C) → wizard → datos empresa + encuesta + T&C proveedor → completa
- [x] 8.4 Confirmar promoción: `profiles.role='SELLER'`, `seller_profiles` creado, respuestas y aceptaciones guardadas; tras refresh el JWT lleva `user_role=SELLER` y accede al panel de proveedores
- [x] 8.5 Confirmar seguridad: un `CUSTOMER` no puede cambiar su rol directamente (RLS/trigger) ni un no-super-admin editar la encuesta
