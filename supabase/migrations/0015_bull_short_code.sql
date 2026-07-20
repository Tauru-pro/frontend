-- ============================================================================
-- 0015_bull_short_code
-- Código del toro (p. ej. "117/2"), distinto del número de registro (`code`).
-- Obligatorio en el formulario de pajilla (validado en la app) y único por
-- vendedor, igual que el número de registro.
-- ============================================================================

ALTER TABLE public.bulls ADD COLUMN IF NOT EXISTS short_code text;

CREATE UNIQUE INDEX IF NOT EXISTS bulls_tenant_short_code_unique
  ON public.bulls (tenant_id, short_code) WHERE short_code IS NOT NULL;
