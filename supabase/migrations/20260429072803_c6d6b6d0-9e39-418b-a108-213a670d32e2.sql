ALTER TABLE public.ordenes_pago
  ADD COLUMN IF NOT EXISTS vobo_verificador_id uuid,
  ADD COLUMN IF NOT EXISTS vobo_verificador_nombre text,
  ADD COLUMN IF NOT EXISTS vobo_at timestamptz,
  ADD COLUMN IF NOT EXISTS vobo_comentario text;