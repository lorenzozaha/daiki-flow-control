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

  IF NOT (public.has_role(_user_id, 'verificador') OR public.has_role(_user_id, 'contador')) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.verificador_scope WHERE user_id = _user_id) INTO tiene_scopes;

  IF NOT tiene_scopes THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.verificador_scope
    WHERE user_id = _user_id AND departamento = _depto
  );
END;
$$;

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
        (public.has_role(auth.uid(), 'verificador') OR public.has_role(auth.uid(), 'contador'))
        AND public.verificador_puede_ver_depto(auth.uid(), departamento)
      )
    )
  )
);

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
        (public.has_role(auth.uid(), 'verificador') OR public.has_role(auth.uid(), 'contador'))
        AND public.verificador_puede_ver_depto(auth.uid(), departamento)
      )
    )
  )
);