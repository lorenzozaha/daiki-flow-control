
-- 1) profiles: restringir SELECT a self + admin + roles operativos dentro de la empresa
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    empresa_id = public.current_user_empresa()
    AND (
      public.has_role(auth.uid(), 'verificador'::app_role)
      OR public.has_role(auth.uid(), 'contador'::app_role)
      OR public.has_role(auth.uid(), 'autorizador'::app_role)
    )
  )
);

-- 2) storage.objects: reemplazar política de comprobantes por una que valide misma empresa
DROP POLICY IF EXISTS comprobantes_select_same_company ON storage.objects;
CREATE POLICY comprobantes_select_same_company
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprobantes'
  AND (
    -- dueño del archivo (folder = uid)
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ordenes_pago op
      WHERE op.comprobante_path = storage.objects.name
        AND op.empresa_id = public.current_user_empresa()
        AND (
          public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'autorizador'::app_role)
          OR (
            public.has_role(auth.uid(), 'verificador'::app_role)
            AND public.verificador_puede_ver_depto(auth.uid(), op.departamento)
          )
        )
    )
  )
);

-- 3) Revocar EXECUTE a anon en helpers SECURITY DEFINER que solo tienen sentido para usuarios firmados
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_empresa() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verificador_puede_ver_depto(uuid, text) FROM PUBLIC, anon;

-- authenticated conserva EXECUTE porque estas funciones son invocadas desde políticas RLS
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_empresa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificador_puede_ver_depto(uuid, text) TO authenticated;

-- bootstrap_needed se llama sin sesión durante el primer arranque del sistema; se mantiene accesible.
