## Why

Hoy los proveedores (`SELLER`) sólo pueden ser creados por un `SUPER_ADMIN` desde el backoffice (Edge Function `admin-create-user`), y los compradores (`CUSTOMER`) se auto-registran en el marketplace. No existe un camino self-service para que un comprador se convierta en proveedor. Queremos un onboarding fluido: cualquier visitante se registra como comprador, explora, y desde una opción visible puede "unirse como proveedor" completando datos de empresa, una encuesta de segmentación definida por el super admin, y los términos y condiciones de proveedor — al terminar, su rol cambia a `SELLER` y accede al panel de proveedores.

## What Changes

- **Registro de comprador con T&C explícitos**: el sign-up público exige aceptar los Términos y Condiciones de comprador (checkbox obligatorio) y registra esa aceptación antes de crear la cuenta.
- **Perfil de comprador**: un `CUSTOMER` autenticado tiene una página de perfil para ver/editar su información personal, con una entrada visible ("Quiero ser proveedor") como punto de partida del onboarding.
- **CTA "Unirse como proveedor" visible** en navbar y perfil. Si el usuario no tiene cuenta, el primer paso es crear la cuenta de comprador (con T&C de comprador); si ya está autenticado, entra directo al wizard.
- **Wizard de onboarding de proveedor** (requiere cuenta) con pasos: (1) datos básicos de la empresa, (2) encuesta de segmentación (definida por el super admin), (3) aceptación de T&C de proveedor. Buena UX: multi-paso con progreso, validación por paso, guardado del avance.
- **Encuesta gestionada por el super admin**: nueva capacidad en el backoffice para definir/editar/ordenar/activar las preguntas de segmentación (tipos: opción única/múltiple, texto, número). El wizard renderiza la encuesta activa y guarda las respuestas.
- **Promoción de rol segura `CUSTOMER` → `SELLER`**: al completar el wizard, una Edge Function con `service_role` valida el payload, crea/actualiza `seller_profiles`, guarda respuestas de la encuesta y la aceptación de T&C, y promueve el rol. El cliente refresca la sesión (nuevo JWT con `user_role=SELLER` y `tenant_id`) y redirige al panel de proveedores.

Fuera de alcance: aprobación manual del proveedor por un admin (el rol cambia de inmediato; `seller_profiles.status` queda `PENDING` para verificación posterior), edición de la encuesta ya respondida, y pasarela de pagos/planes.

## Capabilities

### New Capabilities
- `seller-self-onboarding`: flujo self-service para que un `CUSTOMER` autenticado se convierta en `SELLER` (CTA visible, prerrequisito de cuenta, wizard de datos de empresa + encuesta + T&C de proveedor, promoción de rol vía Edge Function, refresh de sesión y redirección al panel).
- `onboarding-survey-management`: capacidad del `SUPER_ADMIN` para definir y administrar la encuesta de segmentación (preguntas, tipos, opciones, orden, estado activo) que consume el wizard.
- `customer-profile`: página de perfil del `CUSTOMER` autenticado para ver su información personal y acceder a la opción "Quiero ser proveedor".

### Modified Capabilities
- `supabase-authentication`: el registro público de comprador ahora exige aceptar los T&C de comprador antes de crear la cuenta y registra dicha aceptación.

## Impact

- **Base de datos (nuevas migraciones)**: tablas `onboarding_survey_questions`, `seller_onboarding_responses`, `terms_documents` + `terms_acceptances`; RLS asociada. `seller_profiles`/`customer_profiles` ya existen (se reutilizan).
- **Edge Function nueva**: `seller-self-onboard` (patrón de `admin-create-user`, usa `service_role` para saltar el trigger `protect_role_and_status` y promover el rol atómicamente). Ver [0004_rls_policies.sql:38-48](supabase/migrations/0004_rls_policies.sql#L38-L48).
- **Frontend**: nueva ruta/área de onboarding (wizard) accesible a `CUSTOMER`; página de perfil de comprador; CTA en [navbar-component.ts](src/app/shared/components/navbar/navbar-component.ts); gestión de encuesta en el backoffice ([backoffice-routes.ts](src/app/features/backoffice/backoffice-routes.ts)); ajuste al sign-up ([sign-up.component.ts](src/app/features/auth/sign-up/sign-up.component.ts)) para el checkbox de T&C. Servicios/modelos nuevos siguiendo el patrón `core/services` + `core/models`.
- **Sesión/JWT**: tras la promoción se requiere `refreshSession()` para que el hook `custom_access_token_hook` reemita el JWT con el nuevo `user_role` y `tenant_id`.
- Sin breaking changes para flujos existentes de compra o del panel actual de proveedores.
