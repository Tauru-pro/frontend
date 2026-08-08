## Context

Seis campos de teléfono, todos `<input type="tel">` escritos a mano, con el mismo `placeholder="+57 300 000 0000"` y sin validación:

| Pantalla | Campo | Persistencia |
|---|---|---|
| `profile.component.ts` | teléfono | `customer_profiles.phone` vía `CustomerProfileService.save` |
| `profile.component.ts` | WhatsApp | `customer_profiles.whatsapp` vía el mismo `save` |
| `become-seller.component.ts` | teléfono de contacto | `seller_profiles.contact_phone` vía la RPC `submit_seller_onboarding` |
| `seller-settings.component.ts` | teléfono de contacto | `seller_profiles.contact_phone` vía `SellerService.updateMyProfile` |
| `branch-form.component.ts` | teléfono | `branches.phone` vía `BranchService` |
| `checkout.component.html` | teléfono del comprador | `POST {apiUrl}/checkout`, API REST heredada |

Los dos primeros y el de sucursal usan `@angular/forms/signals` (`[formField]`); los de checkout y become-seller usan señales con `[value]`/`(input)`. El componente tiene que servir a ambos estilos.

El checkout es el caso aparte: su teléfono no va a Supabase sino a un backend REST que este repositorio no contiene (no hay tabla `orders` en `supabase/migrations/`). Ahí no podemos añadir una columna.

El catálogo `countries` ya trae `phonecode` y `emoji` para los 250 países (change `seed-world-geography`), y `LocationService.getCountries()` ya los expone ordenados por nombre.

## Goals / Non-Goals

**Goals:**

- Un único componente para capturar teléfonos, reutilizado en las seis posiciones.
- Que el indicativo se elija de forma explícita, con búsqueda, y se guarde en su propia columna.
- Que los teléfonos ya guardados sigan mostrándose correctamente después del cambio.
- Que el componente encaje tanto en formularios `signal-forms` como en formularios de señales sueltas.

**Non-Goals:**

- No se valida la longitud ni el formato del número por país (nada de `libphonenumber`): añade ~150 kB al bundle para un beneficio que hoy nadie pide. La validación se limita a "solo dígitos y separadores".
- No se cambia el contrato de la API REST del checkout ni se añade columna de indicativo a las órdenes.
- No se normalizan a E.164 los teléfonos históricos más allá del backfill descrito: no hay reglas de marcación nacional por país que aplicar.
- No se añade detección automática del país por IP o por locale del navegador.

## Decisions

### 1. Se guarda el indicativo, no el país

La columna nueva guarda `'+57'`, no `'CO'`. Es lo que pidió el requisito y es directamente renderizable: cualquier consumidor (una plantilla de correo, un export) compone el teléfono concatenando las dos columnas, sin join contra `countries`.

El precio es una ambigüedad al recargar: `+1` corresponde a EE.UU. y Canadá, `+7` a Rusia y Kazajistán. El combo tiene que elegir una bandera. La regla de desempate es determinista: entre los países que comparten indicativo se prefiere Colombia si está, y si no, el primero por nombre alfabético. El indicativo mostrado siempre es el correcto; solo la bandera puede no ser la que el usuario eligió originalmente.

*Alternativa descartada*: guardar `iso2`. Elimina la ambigüedad, pero deja el indicativo derivable solo por join, y el requisito era guardar el indicativo.

### 2. Columnas nuevas junto a cada columna de teléfono

```
customer_profiles.phone_country_code            text
customer_profiles.whatsapp_country_code         text
seller_profiles.contact_phone_country_code      text
branches.phone_country_code                     text
```

Nullable, sin default. Un teléfono es "completo" cuando ambas columnas tienen valor; si el número está vacío el indicativo se guarda como `null`, para que "sin teléfono" sea un único estado y no dos.

*Alternativa descartada*: una tabla `phones` polimórfica. Cuatro columnas en tres tablas no justifican una tabla de indirección ni los joins que impondría a cada lectura de perfil.

### 3. El backfill separa el prefijo cuando existe, y asume `+57` cuando no

La migración recorre las cuatro columnas existentes:

1. Si el valor empieza por `+`, se extrae el prefijo más largo que coincida con algún `countries.phonecode` (los indicativos van de 1 a 4 dígitos, así que el emparejamiento debe ser *greedy*, o `+1` se comería `+123`).
2. Si no empieza por `+`, se asigna `'+57'` y el valor completo queda como número nacional.
3. En ambos casos el número nacional se limpia de espacios, guiones y paréntesis.
4. Los valores nulos o vacíos quedan con ambas columnas nulas.

Se ejecuta como SQL dentro de la propia migración —no como script— porque son cuatro `update` sobre tablas de pocas filas y así el backfill viaja con el esquema.

### 4. El componente expone dos entradas y una salida combinada

```ts
@Input() set dialCode(v: string | null)   // '+57'
@Input() set number(v: string | null)     // '3001112222'
@Output() valueChange = EventEmitter<PhoneValue | null>()

interface PhoneValue { dialCode: string; number: string; e164: string }
```

Emitir también `e164` (`'+573001112222'`) evita que cada consumidor repita la concatenación; el checkout usa exactamente ese campo. Se emite `null` cuando el número está vacío, igual que `LocationSelectComponent` emite `null` con la selección incompleta — así los formularios distinguen "sin teléfono" sin comparar cadenas.

Entradas separadas en vez de un único objeto porque las columnas llegan separadas desde el backend y así el consumidor no arma un objeto intermedio solo para pasarlo.

### 5. El combo de país reutiliza `SearchSelectComponent`

Ya resuelve búsqueda, estado de carga, error de validación y dropdown. La etiqueta de cada opción es `🇨🇴 Colombia +57`, de modo que la búsqueda por texto encuentra tanto "colom" como "+57" sin código extra: `SearchSelectComponent` filtra por `label`.

En pantalla el combo va a la izquierda y estrecho (`w-40`), y el número ocupa el resto, en un `flex gap-2`. En móvil se mantienen en fila —un combo de país a ancho completo sobre el número desperdicia espacio vertical— y el combo baja a `w-32`.

### 6. `getCountries()` se cachea con `shareReplay`

El perfil de comprador renderiza dos instancias del componente, y una pantalla de vendedor puede tener el selector de ubicación *y* el de teléfono. Sin caché son tres consultas de 250 filas por pantalla. Un `shareReplay({ bufferSize: 1, refCount: false })` sobre el observable de países lo reduce a una por sesión; el catálogo es de solo lectura, así que la caché no puede quedar obsoleta dentro de una sesión.

### 7. La RPC de onboarding recibe el indicativo en el jsonb que ya usa

`submit_seller_onboarding(p_user_id, p_company jsonb, …)` lee `p_company ->> 'contact_phone'`. Se añade `p_company ->> 'contact_phone_country_code'` sin tocar la firma de la función: el jsonb es precisamente el punto de extensión. Se publica como `create or replace` en la migración nueva, copiando el cuerpo vigente de `0012` con esa línea añadida.

## Risks / Trade-offs

- **El backfill parte números que ya venían mal escritos** (p. ej. `'57 300...'` sin `+`, que se convertiría en `+57` / `'57300...'`) → el emparejamiento *greedy* solo actúa sobre valores que empiezan por `+`; el resto se toma literal como número nacional. Es preferible dejar un número intacto aunque tenga el país embebido a mutilar uno correcto. La migración imprime cuántas filas tocó por tabla para poder revisarlas.
- **Bandera ambigua al recargar `+1`, `+7`, `+44`** → descrito en la decisión 1; el indicativo mostrado siempre es correcto y el usuario puede reelegir el país. Coste aceptado a cambio de guardar el indicativo literal.
- **Migración irreversible en la práctica** (el número pierde el prefijo que llevaba embebido) → el rollback es recomponer `phone = phone_country_code || phone`, lo cual restaura el valor original en todos los casos salvo los espacios internos que el backfill limpió. Se documenta el `update` de reversión en la propia migración.
- **Dos combos de país con etiquetas distintas** (el de ubicación muestra `🇨🇴 Colombia`, el de teléfono `🇨🇴 Colombia +57`) → es deliberado: en un campo de teléfono el indicativo es el dato que el usuario busca. Se acepta la inconsistencia visual.
- **El checkout queda como excepción** (un solo campo, E.164) → el componente ya expone `e164`, así que la excepción se resuelve leyendo otro campo de la misma salida, no con un camino de código aparte.

## Migration Plan

1. Aplicar la migración: cuatro columnas nuevas, backfill de las cuatro columnas existentes y `create or replace` de `submit_seller_onboarding`. Es aditiva salvo por la reescritura de los números, que es el objetivo.
2. Desplegar el frontend. El orden importa: el frontend nuevo lee `*_country_code`, así que la migración va antes.
3. **Rollback**: revertir el frontend restaura las pantallas anteriores, que leen la columna de número. Como el backfill le quitó el prefijo a los números que lo tenían, hay que recomponerlos con `update … set phone = coalesce(phone_country_code,'') || phone` antes de dar por buena la reversión; el `update` va escrito en un comentario al pie de la migración.

## Open Questions

- ¿El WhatsApp del comprador debe poder tener un indicativo distinto al del teléfono? El diseño asume que sí (cada instancia mantiene su propia selección), pero si en la práctica siempre coinciden, convendría copiar el país del teléfono al WhatsApp cuando este último esté vacío.
