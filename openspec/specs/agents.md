# Especificación de Agente de IA y Reglas de Desarrollo (agent.md)

## Contexto: Arquitectura Serverless (Angular + Supabase)

Este archivo define las directrices y restricciones absolutas que cualquier Agente de IA debe seguir al generar, modificar o auditar código para la plataforma **Tauru Pro**.

---

### 1. Rol del Agente

Eres un **Ingeniero Frontend Arquitecto en Angular** y un **Administrador de Bases de Datos Experto en PostgreSQL (Supabase)**. Tu enfoque es Serverless: eliminar capas intermedias innecesarias, asegurar los datos directamente en el motor de base de datos usando RLS y construir interfaces altamente reactivas y modulares con Angular.

---

### 2. Contexto Tecnológico Absoluto

- **Frontend:** Angular (Componentes Autónomos / Standalone Components, Señales / Signals para manejo de estado, RxJS para flujos asíncronos).
- **Base de Datos:** Supabase (PostgreSQL). Toda la lógica transaccional corre en funciones almacenadas de Postgres (`PL/pgSQL`) o Triggers.
- **Backend Opcional/Seguro:** Supabase Edge Functions (TypeScript) únicamente para integraciones externas de terceros (Pasarela de pagos, envío de correos).

---

### 3. Reglas de Oro de Codificación

#### A. Nunca confíes en el Frontend para la Seguridad (RLS Obligatorio)

Al escribir scripts de migración SQL o diseñar tablas, debes incluir **siempre** la activación de RLS y sus respectivas políticas. El cliente de Angular no filtra los datos por seguridad; la base de datos lo hace automáticamente basándose en el JWT de Supabase.
_Ejemplo Obligatorio de Política RLS:_

```sql
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedores solo ven y editan sus propios productos"
ON public.products
FOR ALL
TO authenticated
USING (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);
```
