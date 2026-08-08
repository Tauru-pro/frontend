## 1. Migración: marca, garantías y superficie pública

- [x] 1.1 Crear `supabase/migrations/0018_featured_bull.sql` con `alter table public.bulls add column if not exists is_featured boolean not null default false`
- [x] 1.2 Añadir el índice único parcial `bulls_one_featured_per_tenant on bulls (tenant_id) where is_featured`
- [x] 1.3 Crear la función y el disparador `enforce_featured_bull_approved` (`before insert or update of is_featured on bulls`): si `new.is_featured` y el toro no tiene ninguna pajilla `ACTIVE`, lanzar excepción `BULL_NOT_APPROVED`
- [x] 1.4 Crear la RPC `set_featured_bull(p_bull_id uuid, p_featured boolean)` `security definer`: resolver el `tenant_id` del toro, comprobarlo contra el del JWT, apagar el destacado previo de ese vendedor y aplicar el nuevo, todo en una transacción
- [x] 1.5 Añadir la política `public_read_published_bulls on bulls for select using (exists (select 1 from products p where p.bull_id = bulls.id and p.status = 'ACTIVE'))`
- [x] 1.6 Crear la vista `featured_straws` con `bull_id`, `bull_name`, `breed_name`, `seller_id`, `seller_name`, `cover_path` y `straws` (jsonb agregado: `id`, `straw_type`, `price`, `min_order_quantity`, `stock_quantity`), filtrando `b.is_featured` y `p.status = 'ACTIVE'`
- [x] 1.7 `grant select on public.featured_straws to anon, authenticated`, y dejar comentada en la migración la advertencia de que la vista se salta la RLS y su lista de columnas es la única barrera
- [x] 1.8 Verificar que la migración es idempotente (`if not exists` / `create or replace` / `drop policy if exists` antes de crear)

## 2. Modelo y servicios

- [x] 2.1 Añadir `isFeatured: boolean` a `Bull` en `bull.model.ts` y mapear `is_featured` en `bull.service.ts`
- [x] 2.2 Crear el modelo `FeaturedStraw` (toro + vendedor + variantes) en `product.model.ts` o en un `featured.model.ts` nuevo
- [x] 2.3 Añadir `BullService.setFeatured(bullId, featured)` llamando a la RPC `set_featured_bull`, traduciendo `BULL_NOT_APPROVED` a un mensaje en español
- [x] 2.4 Añadir `getFeaturedStraws()` a `ProductService` consultando `featured_straws`, mapeando el jsonb de variantes y resolviendo `cover_path` con `getMediaPublicUrl`
- [x] 2.5 Exponer `is_featured` en el embed `bulls(...)` de `PRODUCT_SELECT` y en `ProductBull`, que es de donde el listado del vendedor saca la marca (no previsto al planificar)

## 3. Listado del vendedor

- [x] 3.1 Añadir `isFeatured` y `canBeFeatured` a `ListRow` en `product-list.component.ts`; `canBeFeatured` = alguna pajilla del grupo en `ACTIVE` (no `repStatus`, que prioriza el estado que requiere acción)
- [x] 3.2 Poblar ambos campos al construir las filas desde los toros y sus pajillas
- [x] 3.3 Añadir la acción de destacar/quitar en la plantilla de la columna `actions`, solo para `kind === 'straw'`
- [x] 3.4 Estado deshabilitado con motivo visible ("Necesita al menos una pajilla aprobada") cuando `!canBeFeatured`
- [x] 3.5 Marcar visualmente el toro destacado con una estrella `accent`
- [x] 3.6 Implementar el manejador: llamar a `setFeatured`, refrescar el listado y mostrar el error si la RPC lo rechaza
- [ ] 3.7 Comprobar que al destacar un toro nuevo el anterior pierde la marca en la interfaz sin recargar la página — **pendiente del usuario**: requiere un vendedor con dos toros aprobados

## 4. Tarjeta destacada

- [x] 4.1 Crear `FeaturedStrawCardComponent` standalone, `OnPush`, con `input.required<FeaturedStraw>()`
- [x] 4.2 Maquetar según la referencia: imagen de portada (o emoji `🧫` de reserva), "Por «vendedor»", nombre del toro y raza
- [x] 4.3 Selector de variantes con `STRAW_LABELS`; la seleccionada con borde y texto `primary` sobre `primary/10`. Si solo hay una pajilla aprobada, mostrar la etiqueta sin botón
- [x] 4.4 Precio de la variante seleccionada, en grande, con el formato del resto del marketplace
- [x] 4.5 Botón "Agregar" `btn-primary` a ancho completo: resuelve el `Product` completo con `getProduct(variantId)` y luego llama a `CartStore.addItem` con `minOrderQuantity` — la variante de la vista no es un `Product` y el carrito persiste el objeto entero
- [x] 4.6 Marcar la variante sin stock como no disponible y deshabilitar el botón

## 5. Portada

- [x] 5.1 Cargar los destacados en `home.component.ts` con `getFeaturedStraws()` y una señal de carga
- [x] 5.2 Sustituir el bloque `@for (product of featuredProducts...)` de `home.component.html` por la nueva tarjeta
- [x] 5.3 Añadir el estado vacío de la sección (sin destacados) y el esqueleto de carga
- [x] 5.4 Eliminar el array `featuredProducts` del componente
- [x] 5.5 Comprobar que la interfaz `Product` local sigue siendo necesaria para `bestSellers`/`popularProducts`/`dealProduct`, y dejarla solo si es así

## 6. Verificación

- [x] 6.1 Aplicar la migración y comprobar que `GET /rest/v1/bulls` con la anon key ya devuelve los toros con producto activo (hoy devuelve `[]`)
- [x] 6.2 Comprobar que un toro sin producto activo sigue sin ser visible para la anon key
- [x] 6.3 Comprobar con la anon key que `featured_straws` responde y que no expone `contact_phone` ni `address`
- [x] 6.4 Intentar `update bulls set is_featured = true` sobre un toro sin aprobar con el rol del vendedor y confirmar que el disparador lo rechaza
- [ ] 6.5 Confirmar que el índice único impide dos destacados del mismo vendedor — **no verificado**: el índice se creó con la migración, pero probarlo exige dos toros aprobados del mismo vendedor y hoy solo hay uno; inventar datos en la base real no procede
- [x] 6.6 `npm run build` sin errores de tipos
- [ ] 6.7 Probar en dev el circuito completo: destacar un toro aprobado en el listado, verlo aparecer en "Semen Destacado", cambiar de variante, agregarlo al carrito y quitar el destacado — **pendiente del usuario** (requiere sesión de vendedor; la RPC solo acepta un JWT con `tenant_id`)
- [x] 6.8 Comprobar que el catálogo público muestra la raza en lugar de "—" para un visitante sin sesión
