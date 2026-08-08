## Context

El listado del vendedor ([product-list.component.ts](src/app/features/seller/products/product-list.component.ts)) no muestra productos planos: agrupa las pajillas por toro en un `ListRow` con `kind: 'straw' | 'supply'`, cuyo `id` es el `bullId` para pajillas y el `productId` para insumos, y que ya calcula un estado representativo del grupo con `repStatus(straws)`. Se destaca esa fila —el toro—, así que la marca vive en `bulls`.

El catálogo público, en cambio, es plano: `getPublicProducts()` consulta `products` filtrando `status = 'ACTIVE'` y una tarjeta por producto ([product-card.component.ts](src/app/features/marketplace/catalog/product-card.component.ts)).

La portada es simulada de principio a fin: `home.component.ts` declara su propia interfaz `Product` (con `emoji`, `rating`, `reviews`, `originalPrice`) y cuatro arrays escritos a mano, entre ellos `featuredProducts`, que alimenta la sección "Semen Destacado" de `home.component.html`.

**Lo que bloquea la feature**, comprobado contra la base de datos real con la anon key:

```
GET /rest/v1/bulls?select=id,name            → []
GET /rest/v1/products?select=...,bulls(id,name)&status=eq.ACTIVE
                                             → [{ ..., "bulls": null }, ...]
GET /rest/v1/seller_profiles?select=id,business_name → []
```

`bulls` solo tiene las políticas `seller_own_bulls` y `admin_read_all_bulls` ([0009](supabase/migrations/0009_product_catalog_schema.sql)); nunca se le añadió lectura pública. `seller_profiles` igual ([0006](supabase/migrations/0006_seller_tenant_identity.sql)). La tarjeta destacada necesita ambos: nombre del toro, raza y nombre comercial del vendedor.

El precedente para resolverlo ya está en el propio 0009: `product_media` se hace público condicionando a que exista un producto activo que lo referencie.

## Goals / Non-Goals

**Goals:**

- Un toro destacado por vendedor, con el límite garantizado por la base de datos y no solo por la interfaz.
- Que solo pueda destacarse lo que el administrador ya aprobó, verificado también en la base de datos.
- Sustituir el array simulado de "Semen Destacado" por datos reales, sin dejar la portada a medias.
- Una tarjeta fiel a la referencia aportada, con la paleta actual (`primary` cobalto, `secondary` verde, `accent` ámbar).

**Non-Goals:**

- No se tocan `bestSellers`, `popularProducts` ni `dealProduct`: siguen simulados. Convertir toda la portada excede esta regla de negocio.
- No se inventan `rating`, `reviews` ni `originalPrice`: no existen en el dominio y la tarjeta no los muestra. Tampoco el precio por unidad ni el "precio de socio" de la imagen de referencia, que no tienen equivalente en Tauru.
- No hay curaduría del administrador sobre lo destacado: aprobar el producto es la única puerta.
- No hay orden ni límite de cuántos destacados se muestran en portada; con el volumen actual de vendedores no hace falta paginar.

## Decisions

### 1. `bulls.is_featured` con índice único parcial por vendedor

```sql
alter table bulls add column if not exists is_featured boolean not null default false;

create unique index if not exists bulls_one_featured_per_tenant
  on bulls (tenant_id) where is_featured;
```

El índice parcial es lo que convierte "solo uno" en una garantía real: dos filas del mismo `tenant_id` con `is_featured = true` son imposibles, venga la escritura de donde venga.

*Alternativa descartada*: una columna `featured_bull_id` en `seller_profiles`. Expresa igual de bien el límite, pero obliga a escribir en la tabla de perfil para una decisión de catálogo y complica la lectura pública, que tendría que abrir `seller_profiles` para saber qué toro está destacado.

### 2. La aprobación se valida con un disparador, no solo en la interfaz

La política `seller_own_bulls` es `FOR ALL`, así que un vendedor puede escribir cualquier columna de sus toros —incluida `is_featured`— con una llamada directa a PostgREST. Esconder el botón no es una regla de negocio.

```sql
create or replace function enforce_featured_bull_approved() returns trigger ...
  -- si new.is_featured y no existe (select 1 from products
  --   where bull_id = new.id and status = 'ACTIVE') -> raise exception
```

sobre `before insert or update of is_featured on bulls`.

**Aprobación revocada**: si el administrador suspende la última pajilla activa de un toro destacado, el disparador no se entera —la escritura ocurre en `products`—. En vez de añadir un segundo disparador que apague `is_featured` en cascada, la vista de lectura pública ya exige pajillas activas, así que el toro simplemente deja de aparecer. La marca queda puesta y vuelve a surtir efecto si el producto se reactiva, que es el comportamiento deseable.

### 3. Cambiar de destacado es una RPC, no dos escrituras

Marcar B teniendo A destacado, hecho como dos `update` desde el cliente, choca contra el índice único si se ejecuta en el orden equivocado, y deja al vendedor sin destacado si falla el segundo. Una función resuelve ambos problemas de una vez:

```sql
create or replace function set_featured_bull(p_bull_id uuid, p_featured boolean) ...
  -- resuelve el tenant del toro, comprueba que es el del llamante,
  -- apaga el destacado anterior de ese tenant y enciende el nuevo, en una transacción
```

`security definer` con verificación explícita del `tenant_id` del JWT contra el del toro, siguiendo el patrón de `submit_seller_onboarding`.

### 4. Una vista pública en vez de tres políticas nuevas

La tarjeta necesita datos de `bulls`, `products`, `product_media`, `breeds` y `seller_profiles`. Abrir `seller_profiles` a lectura pública expondría **todas** sus columnas a cualquiera —incluidos `contact_phone` y `address`—, porque una política `FOR SELECT` no distingue columnas.

En su lugar, una vista que expone exactamente lo necesario:

```sql
create or replace view featured_straws as
select b.id as bull_id, b.name as bull_name, br.name as breed_name,
       sp.id as seller_id, sp.business_name as seller_name,
       (cover media path del toro) as cover_path,
       jsonb_agg(jsonb_build_object('id', p.id, 'straw_type', p.straw_type,
                 'price', p.price, 'min_order_quantity', p.min_order_quantity,
                 'stock_quantity', p.stock_quantity)) as straws
  from bulls b
  join products p on p.bull_id = b.id and p.status = 'ACTIVE'
  ...
 where b.is_featured
 group by ...;
```

Al pertenecer al rol propietario, la vista lee por debajo de la RLS de sus tablas base, y `grant select` a `anon`/`authenticated` publica solo estas columnas. El agregado devuelve un toro por fila con sus pajillas aprobadas dentro, que es exactamente la forma que consume la tarjeta: una petición, sin `N+1`.

La condición `p.status = 'ACTIVE'` en el `join` es la que hace que un destacado sin aprobación vigente desaparezca solo.

*Alternativa descartada*: una RPC que devuelva JSON. Equivalente en potencia, pero una vista se consulta con `.from('featured_straws').select('*')`, igual que el resto de servicios del repositorio.

### 5. La política pública que le falta a `bulls`, aparte

La vista resuelve la portada, pero no el defecto de fondo: el catálogo público lleva mostrando "—" en lugar de la raza desde que existe, porque `product.bull` llega `null` para los visitantes anónimos. Se añade la política que faltaba, calcada del precedente de `product_media`:

```sql
create policy "public_read_published_bulls" on bulls
  for select using (exists (
    select 1 from products p where p.bull_id = bulls.id and p.status = 'ACTIVE'));
```

Los toros sin producto activo siguen siendo privados. Va en este cambio porque es la misma superficie de lectura y arreglarlo aparte duplicaría la migración.

### 6. El interruptor vive en la columna de acciones, solo en filas de toro

`ListRow` ya distingue `kind`, así que la acción se pinta únicamente en `kind === 'straw'`. Su habilitación depende de que alguna pajilla del grupo esté en `ACTIVE` —`row.straws.some(s => s.status === 'ACTIVE')`—, no de `repStatus`, que devuelve el estado *que requiere acción del vendedor* y sería `REJECTED` para un toro con una pajilla rechazada y otra aprobada, aunque ese toro sí es destacable.

Deshabilitado muestra el motivo ("Necesita al menos una pajilla aprobada"). El destacado actual se marca con una estrella `accent`, el color que el sistema ya reserva para lo destacado.

### 7. La tarjeta traduce la referencia al dominio

| Referencia | Tauru |
|---|---|
| Imagen del producto | Portada del toro; emoji `🧫` de reserva, como en `ProductCardComponent` |
| "Por Fresh step" | "Por «nombre comercial del vendedor»" |
| Título del producto | Nombre del toro + raza |
| Precio grande | Precio de la variante seleccionada |
| "($11,15/gr)" | *Se omite*: no hay precio por unidad en el dominio |
| "Member $65.937 👑" | *Se omite*: no hay precios de socio |
| Variantes "14 LB / 25 LB" | Tipos de pajilla aprobados del toro (Convencional / Sexado Macho / Sexado Hembra), con `STRAW_LABELS` |
| Botón "Agregar" morado | `btn-primary` a ancho completo |

La variante seleccionada usa borde y texto `primary` sobre fondo `primary/10`, igual que la insignia de tipo de pajilla que ya existe en `ProductCardComponent`. Sin variantes seleccionables cuando el toro solo tiene una pajilla aprobada: se muestra su etiqueta sin convertirla en botón.

## Risks / Trade-offs

- **La vista se salta la RLS por diseño** → su `where` es la única barrera, así que cualquier columna añadida a la vista queda pública de inmediato. Se documenta en la propia migración y la lista de columnas se mantiene mínima. Es el mismo compromiso que ya se acepta al publicar productos activos.
- **Abrir `bulls` a lectura pública expone todas sus columnas** de los toros con producto activo, incluida `description` y `code`. Es información de catálogo que el vendedor publica voluntariamente al activar un producto, y la alternativa —una segunda vista solo para el catálogo— duplicaría la consulta de productos por una ganancia dudosa.
- **La marca sobrevive a la pérdida de aprobación** → decidido en la decisión 2: el toro desaparece de la portada pero conserva la marca. El riesgo es que el vendedor crea que sigue destacado; el listado debe mostrar el mismo aviso de "necesita pajilla aprobada" aunque `is_featured` esté puesto.
- **Sin límite de cuántos destacados se pintan** → con un puñado de vendedores no es problema, pero al crecer la sección se alargará sin control. Se anota como candidato a paginar o a rotar, no se resuelve aquí.
- **La portada queda mixta**: una sección con datos reales y tres simuladas. Es deuda visible, pero convertirlas todas no es lo que pide esta regla de negocio y alargaría el cambio sin necesidad.

## Migration Plan

1. Aplicar la migración: columna, índice, disparador, política sobre `bulls`, vista y RPC. Todo aditivo; nadie tiene `is_featured` puesto, así que la portada arranca con la sección vacía.
2. Desplegar el frontend. El orden importa: la portada nueva consulta `featured_straws`.
3. **Rollback**: revertir el frontend basta para volver al estado anterior (la portada vuelve a los datos simulados). Los objetos de base de datos son inertes sin consumidor; si se quiere limpiar, `drop view featured_straws`, `drop function set_featured_bull`, la política, el disparador y la columna, en ese orden.

## Open Questions

- ¿Debe el administrador poder retirar un destacado que considere inapropiado? Este diseño no le da esa palanca; su único control es aprobar o suspender el producto subyacente. Si se quiere moderación explícita, es una política extra sobre `bulls` y un botón en el backoffice.
