-- Tabla de scopes por verificador (por departamento)
CREATE TABLE public.verificador_scope (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  departamento text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, departamento)
);

CREATE INDEX idx_verificador_scope_user ON public.verificador_scope(user_id);

ALTER TABLE public.verificador_scope ENABLE ROW LEVEL SECURITY;

-- Admin: control total
CREATE POLICY "vscope_admin_all" ON public.verificador_scope
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cada usuario puede leer su propio scope
CREATE POLICY "vscope_self_read" ON public.verificador_scope
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Función: ¿el verificador tiene permitido ver este departamento?
-- Reglas: admin/autorizador siempre true. Verificador: si no tiene scopes, true; si tiene, debe coincidir.
CREATE OR REPLACE FUNCTION public.verificador_puede_ver_depto(_user_id uuid, _depto text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tiene_scopes boolean;
BEGIN
  IF public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'autorizador') THEN
    RETURN true;
  END IF;

  IF NOT public.has_role(_user_id, 'verificador') THEN
    -- capturistas no entran por aquí (su política sigue siendo solicitante_id = auth.uid())
    RETURN false;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.verificador_scope WHERE user_id = _user_id) INTO tiene_scopes;

  IF NOT tiene_scopes THEN
    RETURN true; -- sin scopes asignados = ve todo
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.verificador_scope
    WHERE user_id = _user_id AND departamento = _depto
  );
END;
$$;

-- Reescribir política de SELECT de ordenes_pago para incluir el filtro de scope
DROP POLICY IF EXISTS "ordenes_select" ON public.ordenes_pago;

CREATE POLICY "ordenes_select" ON public.ordenes_pago
FOR SELECT TO authenticated
USING (
  solicitante_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (
    empresa_id = public.current_user_empresa()
    AND (
      public.has_role(auth.uid(), 'autorizador')
      OR (
        public.has_role(auth.uid(), 'verificador')
        AND public.verificador_puede_ver_depto(auth.uid(), departamento)
      )
    )
  )
);

-- Reescribir política de UPDATE para que el verificador solo pueda actuar en sus departamentos
DROP POLICY IF EXISTS "ordenes_update" ON public.ordenes_pago;

CREATE POLICY "ordenes_update" ON public.ordenes_pago
FOR UPDATE TO authenticated
USING (
  (solicitante_id = auth.uid() AND status = ANY (ARRAY['borrador'::orden_status, 'devuelta'::orden_status]))
  OR public.has_role(auth.uid(), 'admin')
  OR (
    empresa_id = public.current_user_empresa()
    AND (
      public.has_role(auth.uid(), 'autorizador')
      OR (
        public.has_role(auth.uid(), 'verificador')
        AND public.verificador_puede_ver_depto(auth.uid(), departamento)
      )
    )
  )
);