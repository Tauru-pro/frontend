## 1. Migración de esquema y backfill

- [x] 1.1 Crear `supabase/migrations/0017_phone_country_code.sql` con las cuatro columnas nuevas: `customer_profiles.phone_country_code`, `customer_profiles.whatsapp_country_code`, `seller_profiles.contact_phone_country_code`, `branches.phone_country_code` (todas `text`, nullable, `if not exists`)
- [x] 1.2 Escribir una función auxiliar SQL `split_phone(text)` que devuelva `(dial_code, national)`: emparejamiento *greedy* del prefijo más largo contra `countries.phonecode` cuando el valor empieza por `+`, y `('+57', valor)` cuando no
- [x] 1.3 Backfill de las cuatro columnas usando `split_phone`, limpiando espacios, guiones y paréntesis del número nacional
- [x] 1.4 Dejar nulas ambas columnas cuando el teléfono original es null o cadena vacía
- [x] 1.5 `create or replace function public.submit_seller_onboarding` copiando el cuerpo vigente de `0012` y añadiendo `contact_phone_country_code` desde `p_company`
- [x] 1.6 Documentar al pie de la migración el `update` de reversión (`set phone = coalesce(phone_country_code,'') || phone`)
- [x] 1.7 Verificar que la migración es idempotente y que `split_phone` se elimina o queda marcada como auxiliar al final

## 2. Servicio de países cacheado

- [x] 2.1 Envolver la consulta de `LocationService.getCountries()` en un observable cacheado con `shareReplay({ bufferSize: 1, refCount: false })`, creado una sola vez por instancia del servicio
- [x] 2.2 Verificar que dos suscripciones consecutivas producen una única petición de red (garantizado por construcción: un solo observable memoizado en el servicio `root` con `refCount: false`)

## 3. Componente `PhoneInputComponent`

- [x] 3.1 Crear `src/app/shared/components/phone-input/phone-input.component.ts` standalone, `OnPush`, con plantilla inline y `host: { class: 'block' }`
- [x] 3.2 Definir la interfaz exportada `PhoneValue { dialCode; number; e164 }`
- [x] 3.3 Inputs: `dialCode`, `number`, `label`, `placeholder`, `required`, `showError`, `errorMessage`, `disabled`; output `valueChange: EventEmitter<PhoneValue | null>`
- [x] 3.4 Cargar países con `LocationService.getCountries()` y construir las opciones con etiqueta `{{emoji}} {{name}} +{{phonecode}}`
- [x] 3.5 Preseleccionar Colombia cuando no llega `dialCode`; cuando sí llega, resolver el país con el desempate definido (Colombia primero, si no el primero por nombre)
- [x] 3.6 Maquetar combo (`w-40`, `w-32` en móvil) + campo de número en un `flex gap-2`, reutilizando `SearchSelectComponent` y las clases de input del resto de formularios
- [x] 3.7 Limpiar el número al escribir (permitir solo dígitos, espacios, guiones y paréntesis) y emitir `null` cuando queda vacío
- [x] 3.8 Emitir `valueChange` al cambiar país o número, con `e164` ya compuesto

## 4. Modelos y servicios

- [x] 4.1 Añadir `phoneCountryCode` y `whatsappCountryCode` a `CustomerProfile` y `contactPhoneCountryCode` a `SellerProfile` en `user.model.ts` (y mapearlos en `user.store.ts`, que es quien lee `customer_profiles`)
- [x] 4.2 Añadir `phoneCountryCode` a `Branch`, `CreateBranchDto` y `UpdateBranchDto` en `branch.model.ts`
- [x] 4.3 Mapear las columnas nuevas en `customer-profile.service.ts` (`CustomerPersonalData` + el `row` que escribe)
- [x] 4.4 Mapear `contact_phone_country_code` en `seller.service.ts` (lectura en el mapper de fila y escritura en `updateMyProfile`)
- [x] 4.5 Añadir `contact_phone_country_code` al `SellerCompanyData` de `seller-onboarding.service.ts`
- [x] 4.6 Mapear `phone_country_code` en `branch.service.ts` (lectura, `create` y `update`)

## 5. Pantallas

- [x] 5.1 `profile.component.ts`: reemplazar los dos inputs por `app-phone-input`, con señales separadas para teléfono y WhatsApp, y enviar ambos indicativos al guardar
- [x] 5.2 `become-seller.component.ts`: reemplazar el input de teléfono de contacto, enviar el indicativo en el `company` de la RPC y persistirlo en el borrador de `sessionStorage`
- [x] 5.3 `seller-settings.component.ts`: reemplazar el input, precargando indicativo y número desde el perfil
- [x] 5.4 `branch-form.component.ts`: reemplazar el input (usa `signal-forms`, así que el valor se sincroniza contra el modelo del formulario en el handler)
- [x] 5.5 `checkout.component.html` + `.ts`: reemplazar el input y enviar `e164` en `buyerPhone`
- [x] 5.6 Verificar que no quedan `<input type="tel">` sueltos en `src/`

## 6. Verificación

- [x] 6.1 Aplicar la migración en la base de datos y comprobar el backfill: ningún teléfono no vacío queda sin indicativo, y los números nacionales no conservan el `+`
- [x] 6.2 Comprobar los teléfonos existentes: sucursal `+57`/`3174424727`, `test` `+57`/`3006448749`, y `Brahman Friends` correctamente detectado como `+1`/`720678122`
- [x] 6.3 `npm run build` sin errores de tipos
- [ ] 6.4 Probar en dev: guardar un teléfono con indicativo distinto de `+57`, recargar el formulario y confirmar que país y número se restauran — **pendiente del usuario** (requiere navegador con sesión)
- [ ] 6.5 Probar que el perfil de comprador admite indicativos distintos en teléfono y WhatsApp — **pendiente del usuario** (requiere navegador con sesión)
- [ ] 6.6 Confirmar en la red que una pantalla con dos selectores de país hace una sola consulta a `countries` — **pendiente del usuario** (requiere navegador; ver 2.2)
