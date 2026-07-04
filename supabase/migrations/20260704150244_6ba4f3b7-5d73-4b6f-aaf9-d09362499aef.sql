CREATE OR REPLACE FUNCTION public.verificador_puede_ver_depto(_user_id uuid, _depto text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  tiene_scopes boolean;
BEGIN
  IF public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'autorizador') THEN
    RETURN true;
  END IF;

  -- Contador: acceso total a todos los departamentos por diseño
  IF public.has_role(_user_id, 'contador') THEN
    RETURN true;
  END IF;

  IF NOT public.has_role(_user_id, 'verificador') THEN
    RETURN false;
  END IF;

  -- Verificador: fail-closed. Sin scope asignado, no ve nada.
  SELECT EXISTS (SELECT 1 FROM public.verificador_scope WHERE user_id = _user_id) INTO tiene_scopes;

  IF NOT tiene_scopes THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.verificador_scope
    WHERE user_id = _user_id AND departamento = _depto
  );
END;
$function$;