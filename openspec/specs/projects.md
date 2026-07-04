Especificación Abierta de Proyecto (Open Spec)

## Plataforma Marketplace de Genética Bovina e Insumos Ganaderos

---

### 1. Visión General del Proyecto

El objetivo de este proyecto es el desarrollo de una plataforma marketplace multi-tenant especializada en la comercialización, distribución y logística de material genético bovino (pajillas de semen de toro, embriones) e insumos ganaderos generales. El sistema permitirá el aislamiento lógico de datos entre ganaderías/vendedores mediante una arquitectura multi-tenant eficiente sobre una base de datos única, integrando un flujo estricto de aprobación por parte de la administración, control riguroso de inventarios descentralizados por sucursales, cálculo automatizado de comisiones y auditoría transaccional completa.

### 2. Arquitectura de Referencia y Stack Tecnológico

- **Frontend:** Angular (Diseño modular, responsive, consumo de APIs versionadas).
- **Backend:** Supabase Edge Functions (TypeScript) únicamente para integraciones externas de terceros (Pasarela de pagos, envío de correos).
- **Base de Datos & Seguridad:** Supabase / PostgreSQL. Implementación mandatoria de **Row Level Security (RLS)** mapeado al `tenantId` de los usuarios con rol `SELLER` para garantizar el aislamiento de datos a nivel de motor.
- **Persistencia y ORM:** TypeORM / Sequelize (integrado con el flujo transaccional de NestJS).
- **Almacenamiento de Archivos:** Supabase Storage (Buckets privados para PDFs de certificación/pedigrí y públicos para imágenes/videos de catálogo).
- **Autenticación:** JWT (JSON Web Tokens) con manejo de estados/roles en el payload.

---

### 3. Modelo de Datos y Estrategia Multi-Tenant (Estricto)

Cada registro asociado a la actividad comercial de una ganadería o tienda debe incluir una columna `tenant_id` (UUID). Las políticas RLS de PostgreSQL interceptarán de forma nativa las consultas basándose en el contexto del usuario autenticado (`auth.uid()` y variables de sesión mapeadas al tenant).

```
+------------------------------------------------------------------------+
|                            BASE DE DATOS ÚNICA                         |
|                                                                        |
|  +-------------------------+      +---------------------------------+  |
|  |   Tabla: RAZAS (Global)  |      | Tabla: USUARIOS / ROLES (Global)|  |
|  +-------------------------+      +---------------------------------+  |
|                                                                        |
|  ================== POLÍTICAS ROW LEVEL SECURITY (RLS) ================  |
|                                                                        |
|  +------------------------------------------------------------------+  |
|  | TENANT A (tenant_id = 'uuid-aaaa-...')                           |  |
|  | - Tiendas, Sucursales, Inventarios por Sucursal                 |  |
|  | - Pajillas (Semen/Toro) e Insumos Propios                        |  |
|  | - Movimientos de Inventario y Órdenes de Venta                   |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|  +------------------------------------------------------------------+  |
|  | TENANT B (tenant_id = 'uuid-bbbb-...')                           |  |
|  | - Tiendas, Sucursales, Inventarios por Sucursal                 |  |
|  | - Pajillas (Semen/Toro) e Insumos Propios                        |  |
|  | - Movimientos de Inventario y Órdenes de Venta                   |  |
|  +------------------------------------------------------------------+  |
+------------------------------------------------------------------------+
```

---

### 4. Especificación Detallada de Requerimientos Funcionales (RF)

#### Módulo 1: Gestión de Usuarios y Autenticación

- **RF-001 Autenticación:** Registro e inicio de sesión seguro usando email y contraseña. Retorno de JWT firmado por el backend con expiración configurada (e.g., 24h).
- **RF-002 Roles del Sistema:** \* `SUPER_ADMIN`: Control global de la plataforma, aprobación de catálogos, parametrización de comisiones globales y maestros de razas.
  - `SELLER`: Gestión de su propio Tenant (tiendas, sucursales, inventarios, productos y visualización de sus estados financieros).
  - `CUSTOMER`: Navegación, compra, gestión de carrito, geolocalización de sucursales para recolección y órdenes de compra.
- **RF-003 Recuperación de Contraseña:** Flujo asíncrono mediante envío de token temporal/OTP por correo electrónico con expiración de 15 minutos.
- **RF-004 Perfil de Usuario:** Actualización de datos maestros (Nombre, Teléfono, Dirección, Fotografía en Supabase Storage, Contraseña cifrada con `bcrypt`).

#### Módulo 2: Gestión Multi-Tenant e Identidad Comercial

- **RF-005 Arquitectura Multi-Tenant:** Aislamiento lógico estricto en una sola base de datos. Los datos de _Productos, Inventarios, Sucursales, Ventas y Reportes_ deben filtrarse de manera imperativa en la capa de datos agregando la condición `tenantId = context.tenantId` si el rol es `SELLER`.
- **RF-006 Registro de Tienda (Ganadería):** Un `SELLER` puede dar de alta su ganadería o central genética indicando: Nombre comercial, Logo, Descripción, Dirección principal, Ciudad, País, Teléfono, Correo, Horario operativo y Estado (Activo/Inactivo).

#### Módulo 3: Infraestructura Descentralizada (Sucursales)

- **RF-007 Gestión de Sucursales:** Cada tienda puede registrar $N$ sucursales físicas (centros de despacho/almacenamiento criogénico). Atributos obligatorios: Nombre, Dirección, Coordenadas GPS (Latitud/Longitud para cálculo de distancia), Ciudad, Horario y Estado.

#### Módulo 4: Maestro de Razas Ganaderas

- **RF-008 Control de Razas:** Operaciones CRUD (_Create, Read, Update, Delete_) restringidas exclusivamente al `SUPER_ADMIN`. Mantiene la integridad y homogeneidad taxonómica en el Marketplace (ej: Brahman, Angus, Holstein, Gyr, Nelore).

#### Módulo 5: Catálogo Avanzado de Productos (Pajillas vs Insumos)

- **RF-009 Registro de Pajillas (Material Genético):** Alta de semen de toros reproductores. Requiere metadatos técnicos específicos de la industria pecuaria:
  - Nombre, Slug (URL amigable), Código SKU único.
  - Precio, Descripción, Estado.
  - Inventario inicial asignado a una Sucursal específica.
  - **Documentación PDF:** Certificado de registro genealógico, árbol genealógico (pedigrí), y/o reporte de evaluación andrológica/parámetros C.A.S.A. (Semen de alta calidad).
  - Multimedia: Hasta 3 imágenes y 1 video demostrativo del toro (Máx. 100 MB).
- **RF-010 Registro de Insumos Ganaderos:** Productos comerciales estándar (Crinas, tanques criogénicos de nitrógeno líquido, guantes de palpación, termos de descongelación, etc.). Requiere: Nombre, SKU, Categoría, Precio, Descripción, Hasta 3 imágenes, Inventario y Sucursal de almacenamiento.
- **RF-011 Flujo de Validación y Moderación:** Todo producto nuevo o editado por un `SELLER` entra en estado `Pendiente`. El `SUPER_ADMIN` audita el producto desde su panel y puede cambiar el estado a: **Aprobar** (Pasa a visible en Marketplace), **Rechazar** o **Solicitar Cambios** (Envia notificación al vendedor).
- **RF-012 Máquina de Estados del Producto:** Un producto transiciona estrictamente entre los siguientes estados: `Pendiente` $
ightarrow$ `Publicado` / `Rechazado` / `Agotado` / `Inactivo`.

#### Módulo 6: Gestión de Inventario Crítico y Cadena de Frío

- **RF-013 Control de Stock por Sucursal:** El inventario no es global por tienda, se particiona obligatoriamente por sucursal para soportar la logística de entrega local y mantenimiento criogénico. Cada transacción física requiere un tipo de movimiento indexado: `Entrada`, `Salida`, `Ajuste`, `Venta`, `Cancelación`.
- **RF-014 Historial Inmutable:** Libro contable de inventario (`inventory_logs`). Ningún registro de stock se borra o actualiza directamente; se inserta un nuevo movimiento calculando el saldo delta.
- **RF-015 Alertas de Stock Mínimo:** Disparador automático cuando las existencias caen por debajo del umbral de seguridad definido por el vendedor para el producto/sucursal, generando alertas inmediatas en el dashboard y vía email.

#### Módulo 7: Experiencia de Compra (Catálogo, Carrito y Geolocalización)

- **RF-016 Catálogo Público Complejo:** Exposición exclusiva de productos con estado `Publicado` e inventario $> 0$. Incluye motor de búsqueda por texto indexado y filtros avanzados por: _Precio (Rango), Raza bovina, Disponibilidad inmediata, Ubicación geográfica (Ciudad/País)_.
- **RF-017 Operaciones del Carrito de Compras:** Cálculo en memoria/sesión del cliente y validación en backend de: Subtotal, Impuestos (IVA aplicable por país/insumo), Comisión de la plataforma calculada dinámicamente y el Monto Total Neto.
- **RF-018 Selección de Sucursal por Cercanía (Checkout):** Antes de la confirmación de la orden, el sistema solicita acceso a la ubicación del `CUSTOMER` o código postal/ciudad para calcular mediante la fórmula de Haversine (u ordenamiento espacial en PostGIS si se habilita) las sucursales más cercanas con existencias disponibles del producto seleccionado para su recolección o despacho eficiente.
- **RF-019 Estructura de la Orden de Compra:** Generación de un registro único de orden que contiene: Número consecutivo único de orden, Relación de Cliente, Detalles de Productos, Cantidades, Comisión calculada para la plataforma, Impuestos retenidos, Total General y Estado de la Orden (`Pendiente`, `Pagada`, `En Proceso de Despacho`, `Entregada`, `Cancelada`).

#### Módulo 8: Pasarela de Pagos e Ingeniería de Comisiones (Crítico)

- **RF-020 Pasarela de Pagos:** Integración vía Webhooks/API con pasarelas de pago (Stripe, MercadoPago, etc.). Gestión de estados de pago síncronos y asíncronos: `Pendiente`, `Aprobado`, `Rechazado`, `Cancelado`, `Reembolsado`.
- **RF-021 Motor Jerárquico de Comisiones:** El `SUPER_ADMIN` puede estructurar y parametrizar las reglas de cobro de la plataforma bajo una jerarquía de anulación (Precedencia de la regla más específica):
  1.  Comisión específica por Vendedor/Tenant.
  2.  Comisión específica por Categoría de Producto (e.g., Pajillas de Toros Elite vs Insumos estándar).
  3.  Comisión global de la plataforma (Fija o Porcentual estándar).
- **RF-022 Distribución Contable Automatizada (Split Payouts):** En el instante en que el webhook de la pasarela confirma un pago como `Aprobado`, el backend ejecuta la lógica financiera en una transacción aislada de base de datos aplicando la siguiente fórmula matemática:
  $$ ext{Ganancia Vendedor} = ext{Precio Bruto Producto} - ext{Comisión Plataforma} - ext{Impuestos Relacionados} - ext{Descuentos Aplicados}$$
- **RF-023 Libro de Liquidación (Payout Ledger):** Registro histórico inmutable de los montos resultantes para auditoría financiera: Valor bruto recaudado, Comisión exacta cobrada por el marketplace, IVA retenido, Valor neto asignado al saldo del vendedor y Estado de dispersión/pago al vendedor (`Pendiente de Liquidar`, `Liquidado`).

#### Módulo 9: Inteligencia de Negocios y Reportes Analíticos

- **RF-024 Dashboard Consolidado (SUPER_ADMIN):** Panel central con métricas acumuladas de ventas (Diarias, Semanales, Mensuales, Anuales), volumen total de órdenes procesadas, conteo de nuevos usuarios y registros de tiendas autorizadas.
- **RF-025 Reporte Financiero de Plataforma:** Auditoría de ingresos directos del Marketplace: Sumatoria de comisiones generadas, desglose de ingresos por vendedor y utilidad neta operacional de la plataforma.
- **RF-026 Panel Analítico del Vendedor (Tenant Dashboard):** Acceso privado para el `SELLER` enfocado en su operación: Total facturado, Órdenes completadas, Comisiones deducidas por el sistema, Ganancia neta real en su cuenta, Top de productos/toros más demandados y estatus actual de inventario crítico por sucursal.
- **RF-027 Capa de Visualización Gráfica:** Renderización en el frontend mediante gráficos interactivos de series de tiempo para tendencias de ventas, diagramas de barras para productos líderes y gráficos de pastel para categorías dominantes.

#### Módulo 10: Notificaciones y Trazabilidad Transaccional

- **RF-028 Subsistema de Notificaciones:** Despacho de alertas automatizadas multicanal (Email y alertas internas del sistema) activadas por eventos de ciclo de vida del negocio: Creación de orden, Aprobación/Rechazo de producto por moderación, Éxito de pago, Cancelaciones de pedidos e Inventario por debajo del Stock Mínimo.
- **RF-029 Módulo de Auditoría Forense (Producción):** Registro estricto en la tabla `audit_logs` de cualquier operación de mutación de datos (`INSERT`, `UPDATE`, `DELETE`), eventos de autenticación, alteraciones de inventarios y cambios en listas de precios. Atributos requeridos por registro: Identificador de Usuario, Timestamp de precisión de milisegundos, Dirección IP de origen y Detalle JSON con el estado anterior y posterior del registro afectado.
- **RF-030 Panel General de Administración Extensible:** Interfaz exclusiva de `SUPER_ADMIN` para la gestión y control total de entidades maestras, configuración de banners promocionales, estructura de la página principal del marketplace, parametrización del sistema y categorías globales.

---

### 5. Requerimientos Técnicos y de Arquitectura (No Funcionales)

#### Arquitectura de Software y Persistencia

- **Aislamiento RLS en Postgres:** La base de datos compartida implementará políticas que validen el contexto del token enviado. Ejemplo conceptual de la política RLS:
  ```sql
  CREATE POLICY tenant_isolation_policy ON products
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));
  ```
- **Estrategia de Soft Delete:** Las entidades críticas (Usuarios, Tiendas, Sucursales, Productos) no ejecutan sentencias `DELETE` físicas. Implementan una columna `deleted_at` (Timestamp). Toda consulta de lectura del sistema debe incluir por defecto el filtro de exclusión de registros dados de baja (`deleted_at IS NULL`).
- **Validación de Capas y Tipado:** El backend en NestJS utilizará interceptores globales para la transformación y validación estricta de DTOs de entrada. Las salidas de las APIs deben estar debidamente paginadas (`page`, `limit`), ordenadas (`sortBy`, `sortOrder`) y estructuradas de forma homogénea.
- **Documentación Viva:** Auto-generación del contrato de API mediante `@nestjs/swagger`, exponiendo la especificación OpenAPI en la ruta `/api/docs`.

#### Seguridad y Desempeño

- **Cifrado de Credenciales:** Contraseñas hasheadas en base de datos con algoritmo `bcrypt` utilizando un factor de costo mínimo de 10 saltos.
- **Protección de Capas:** Mitigación nativa de SQL Injection mediante el uso estricto de parámetros preparados en el ORM. Implementación de políticas CORS restrictivas, cabeceras de seguridad Helmet en NestJS y validación de tokens antifalsificación (CSRF) en operaciones que lo requieran.
- **Canales Seguros:** Encriptación de datos en tránsito mandatoria mediante protocolo TLS 1.3 / HTTPS.
- **Objetivos de Rendimiento:** Consultas de lectura comunes optimizadas mediante índices en PostgreSQL (índices B-Tree en columnas de búsqueda frecuentes como `sku`, `slug`, `tenant_id` e índices compuestos para optimizar filtros de catálogo) para asegurar tiempos de respuesta del servidor (TTFB) inferiores a 2 segundos en condiciones normales de carga concurrente.
- **Disponibilidad y Respaldo:** Diseño orientado a una disponibilidad del 99.5%. Configuración automatizada de backups diarios con retención mínima de 30 días de la base de datos de Supabase.

---

### 6. Matriz de Priorización del MVP (Estrategia de Lanzamiento)

Para garantizar un despliegue rápido y robusto en producción, las funcionalidades se agrupan en tres fases de desarrollo lógico:

| Módulo / Funcionalidad                         | Prioridad (MVP / Fase 2 / Fase 3) | Estado de Definición   |
| :--------------------------------------------- | :-------------------------------- | :--------------------- |
| **Autenticación, Roles y JWT**                 | Alta (MVP)                        | Completamente Definido |
| **Aislamiento Multi-Tenant (RLS)**             | Alta (MVP)                        | Completamente Definido |
| **Gestión de Tiendas y Sucursales**            | Alta (MVP)                        | Completamente Definido |
| **Maestro Global de Razas**                    | Alta (MVP)                        | Completamente Definido |
| **Catálogo de Productos (Pajillas / Insumos)** | Alta (MVP)                        | Completamente Definido |
| **Flujo de Moderación de Productos**           | Alta (MVP)                        | Completamente Definido |
| **Inventario Descentralizado por Sucursal**    | Alta (MVP)                        | Completamente Definido |
| **Búsqueda y Filtros del Catálogo Público**    | Alta (MVP)                        | Completamente Definido |
| **Carrito de Compras y Selección de Sucursal** | Alta (MVP)                        | Completamente Definido |
| **Checkout, Generación de Órdenes y Pagos**    | Alta (MVP)                        | Completamente Definido |
| **Motor Contable de Comisiones y Retenciones** | Alta (MVP)                        | Completamente Definido |
| **Dashboards de Métricas Esenciales**          | Alta (MVP)                        | Completamente Definido |
| **Logs de Auditoría Transaccional**            | Alta (MVP)                        | Completamente Definido |
| **Notificaciones por Email y Sistema**         | Media (Fase 2)                    | En Especificación      |
| **Módulo Analítico Avanzado con Gráficos**     | Media (Fase 2)                    | En Especificación      |
| **Gestión de Banners y Contenido Dinámico**    | Baja (Fase 3)                     | Planificado            |
