## Why

Hoy hay seis campos de teléfono repartidos en cinco archivos, cada uno un `<input type="tel">` copiado con su propio marcado, su propio `placeholder="+57 300 000 0000"` y ninguna validación. El indicativo del país es solo una sugerencia del placeholder: si el usuario lo escribe, queda mezclado dentro del texto del número; si no, el número se guarda sin país. Ahora que el catálogo `countries` tiene `phonecode` y `emoji` para los 250 países del mundo, el marketplace puede pedir el indicativo explícitamente y guardarlo aparte del número.

## What Changes

- **Nuevo componente compartido** `PhoneInputComponent` (`shared/components/phone-input/`): combo de país buscable —bandera + nombre + indicativo, alimentado por `LocationService.getCountries()`— junto al campo de número, con etiqueta, estado de error y `required` configurables por `input()`. Emite indicativo y número por separado.
- **Los seis campos de teléfono pasan a usarlo**: perfil de comprador (teléfono y WhatsApp), onboarding de vendedor, ajustes de vendedor, formulario de sucursal y checkout.
- **El indicativo se persiste en columna propia**: `customer_profiles.phone_country_code` y `whatsapp_country_code`, `seller_profiles.contact_phone_country_code`, `branches.phone_country_code`. Se guarda el indicativo en formato `+57`, y la columna de número pasa a contener solo el número nacional.
- **Backfill de los datos existentes**: los teléfonos ya guardados se separan en indicativo + número nacional asumiendo Colombia (`+57`) cuando no traen prefijo, ya que el marketplace fue exclusivamente colombiano hasta ahora.
- **La RPC `submit_seller_onboarding` acepta el indicativo** en su `p_company` jsonb y lo persiste junto al número.
- **El checkout compone E.164**: su teléfono viaja a la API REST heredada (`POST /checkout`), cuyo esquema este repo no controla, así que `buyerPhone` sigue siendo un solo campo y se envía como `+573001112222`.
- **`LocationService.getCountries()` se cachea** (`shareReplay`) porque ahora puede haber dos o más selectores de país en la misma pantalla.

## Capabilities

### New Capabilities

- `phone-input`: captura de números telefónicos con indicativo de país seleccionable, su formato de persistencia y su reutilización en todos los formularios del marketplace.

### Modified Capabilities

- `geography-catalog`: `getCountries()` pasa a servir una lista cacheada y compartida entre suscriptores, en lugar de emitir una consulta por cada componente que la pide.

## Impact

- **Base de datos**: nueva migración sobre `customer_profiles` (2 columnas), `seller_profiles` (1) y `branches` (1), más el backfill de las filas existentes y una nueva versión de `submit_seller_onboarding`.
- **Código nuevo**: `shared/components/phone-input/phone-input.component.ts`.
- **Código modificado**: `location.service.ts`; los modelos `user.model.ts`, `branch.model.ts`; los servicios `customer-profile.service.ts`, `seller.service.ts`, `seller-onboarding.service.ts`, `branch.service.ts`; y las cinco pantallas que hoy dibujan un `<input type="tel">` a mano.
- **Sin cambios** en la API REST heredada del checkout ni en la forma de `CheckoutFromCartDto`.
