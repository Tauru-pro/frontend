## 1. NavItem interface — badge field

- [x] 1.1 Añadir `badge?: number` a la interfaz `NavItem` en `src/app/shared/interfaces/nav-item.interface.ts`

## 2. SidebarComponent — renderizar badge

- [x] 2.1 En el template de `src/app/shared/components/sidebar/sidebar.component.ts`, localizar el bloque `<a routerLink>` que itera los nav items y añadir una píldora `@if (item.badge && item.badge > 0)` con clases `absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center`; mostrar `{{ item.badge > 9 ? '9+' : item.badge }}`

## 3. ProductService — getPendingCount()

- [x] 3.1 Añadir método `getPendingCount(): Observable<number>` en `src/app/core/services/product.service.ts` que llama a `this.getAllPendingValidation(1, 1)`, aplica `.pipe(map(res => res.total), catchError(() => of(0)))` y retorna el resultado
- [x] 3.2 Añadir imports de `map`, `catchError`, `of` desde `rxjs` si no existen ya

## 4. BackofficeLayoutComponent — exponer nav item + badge reactivo

- [x] 4.1 Descomentar el bloque del nav item "Productos" (líneas ~50–53) en `src/app/shared/layouts/backoffice-layout.component.ts`
- [x] 4.2 Añadir imports: `PLATFORM_ID`, `isPlatformBrowser` de `@angular/common`; `toSignal` de `@angular/core/rxjs-interop`; `signal` de `@angular/core`; `ProductService` de `core/services/product.service`
- [x] 4.3 Crear signal `pendingCount` en el constructor/campo de clase: `isPlatformBrowser(inject(PLATFORM_ID)) ? toSignal(inject(ProductService).getPendingCount(), { initialValue: 0 }) : signal(0)`
- [x] 4.4 Convertir `adminNavItems` de `private readonly NavItem[]` a `private readonly adminNavItems` donde el item "Productos" incluye `badge: this.pendingCount()` — esto requiere hacer que `navItems` sea un `computed` que lee `this.pendingCount()` y construye el array con el badge en el item correcto

## 5. products.component.ts — fix submitModal()

- [x] 5.1 Importar `submit` de `@angular/forms/signals` en `src/app/features/backoffice/products/products.component.ts`
- [x] 5.2 Reemplazar el cuerpo de `submitModal()` para usar `submit(this.notesForm, async () => { ... })` de modo que las validaciones del formulario se activen al intentar enviar con campo vacío

## 6. Verificación

- [x] 6.1 Ejecutar `ng build` y corregir errores de compilación; verificar que el build SSR termine sin errores
