
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('capturista', 'verificador', 'autorizador', 'admin');
CREATE TYPE public.orden_status AS ENUM ('borrador', 'en_revision', 'en_autorizacion', 'aprobada', 'rechazada', 'devuelta');
CREATE TYPE public.orden_prioridad AS ENUM ('normal', 'urgente');
CREATE TYPE public.orden_frecuencia AS ENUM ('mensual', 'quincenal', 'semanal');
CREATE TYPE public.autorizado_por_rol_t AS ENUM ('verificador', 'autorizador');

-- =========================================
-- EMPRESAS
-- =========================================
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

INSERT INTO public.empresas (nombre) VALUES ('Mitsubishi Daiki');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL DEFAULT '',
  empresa_id UUID REFERENCES public.empresas(id),
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get empresa_id of current user
CREATE OR REPLACE FUNCTION public.current_user_empresa()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

-- =========================================
-- CONFIGURACION DE LIMITES
-- =========================================
CREATE TABLE public.configuracion_limites (
  id INT PRIMARY KEY DEFAULT 1,
  verificador_auto_aprueba_max NUMERIC NOT NULL DEFAULT 2000,
  verificador_alerta_activa_max NUMERIC NOT NULL DEFAULT 5000,
  autorizador_una_firma_max NUMERIC NOT NULL DEFAULT 200000,
  verificador_limite_mensual NUMERIC NOT NULL DEFAULT 50000,
  verificador_warning_pct NUMERIC NOT NULL DEFAULT 80,
  ventana_revocacion_horas INT NOT NULL DEFAULT 24,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_row_only CHECK (id = 1)
);
ALTER TABLE public.configuracion_limites ENABLE ROW LEVEL SECURITY;

INSERT INTO public.configuracion_limites (id) VALUES (1);

-- =========================================
-- CATALOGOS
-- =========================================
CREATE TABLE public.catalogo_departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.catalogo_departamentos ENABLE ROW LEVEL SECURITY;

INSERT INTO public.catalogo_departamentos (nombre) VALUES
  ('Nuevos'),('Seminuevos'),('Refacciones'),('Servicio'),
  ('Administración'),('Recursos Humanos');

CREATE TABLE public.catalogo_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.catalogo_categorias ENABLE ROW LEVEL SECURITY;

INSERT INTO public.catalogo_categorias (nombre) VALUES
  ('Nómina'),('Proveedores'),('Servicios'),('Arrendamiento'),
  ('Mantenimiento'),('Publicidad y Marketing'),('Viáticos'),
  ('Activo Fijo'),('Impuestos y SAT'),('Otro');

-- =========================================
-- ORDENES DE PAGO
-- =========================================
CREATE TABLE public.ordenes_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio SERIAL UNIQUE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  solicitante_id UUID NOT NULL REFERENCES auth.users(id),
  departamento TEXT NOT NULL,
  categoria_gasto TEXT NOT NULL,
  concepto TEXT NOT NULL CHECK (char_length(concepto) <= 200),
  proveedor_nombre TEXT NOT NULL DEFAULT '',
  proveedor_rfc TEXT,
  monto NUMERIC NOT NULL CHECK (monto >= 0),
  moneda TEXT NOT NULL DEFAULT 'MXN',
  fecha_pago_requerida DATE,
  recurrente BOOLEAN NOT NULL DEFAULT false,
  frecuencia orden_frecuencia,
  prioridad orden_prioridad NOT NULL DEFAULT 'normal',
  centro_costo TEXT,
  comprobante_path TEXT,
  notas TEXT,
  status orden_status NOT NULL DEFAULT 'borrador',
  autorizado_por_rol autorizado_por_rol_t,
  autorizado_por_id UUID REFERENCES auth.users(id),
  autorizado_at TIMESTAMPTZ,
  revocable_hasta TIMESTAMPTZ,
  revocada BOOLEAN NOT NULL DEFAULT false,
  firmas_requeridas INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ordenes_empresa_status_idx ON public.ordenes_pago(empresa_id, status);
CREATE INDEX ordenes_solicitante_idx ON public.ordenes_pago(solicitante_id);
ALTER TABLE public.ordenes_pago ENABLE ROW LEVEL SECURITY;

-- =========================================
-- HISTORIAL
-- =========================================
CREATE TABLE public.orden_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_pago(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nombre TEXT,
  accion TEXT NOT NULL,
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orden_historial_orden_idx ON public.orden_historial(orden_id);
ALTER TABLE public.orden_historial ENABLE ROW LEVEL SECURITY;

-- =========================================
-- AUTORIZACIONES MULTIFIRMA
-- =========================================
CREATE TABLE public.orden_autorizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_pago(id) ON DELETE CASCADE,
  autorizador_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orden_id, autorizador_id)
);
ALTER TABLE public.orden_autorizaciones ENABLE ROW LEVEL SECURITY;

-- =========================================
-- ACUMULADO MENSUAL VERIFICADOR
-- =========================================
CREATE TABLE public.acumulado_mensual_verificador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verificador_id UUID NOT NULL REFERENCES auth.users(id),
  anio INT NOT NULL,
  mes INT NOT NULL,
  monto_acumulado NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (verificador_id, anio, mes)
);
ALTER TABLE public.acumulado_mensual_verificador ENABLE ROW LEVEL SECURITY;

-- =========================================
-- EMAIL LOG
-- =========================================
CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  destinatarios TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  orden_id UUID REFERENCES public.ordenes_pago(id) ON DELETE SET NULL,
  ok BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- =========================================
-- HELPER FUNCTIONS
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER ordenes_updated_at BEFORE UPDATE ON public.ordenes_pago
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_empresa UUID;
BEGIN
  SELECT id INTO default_empresa FROM public.empresas ORDER BY created_at LIMIT 1;
  INSERT INTO public.profiles (id, email, nombre, empresa_id, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    default_empresa,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- RLS POLICIES
-- =========================================

-- EMPRESAS: todos pueden leer, solo admin modifica
CREATE POLICY "empresas_read_all" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresas_admin_all" ON public.empresas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES: cada uno lee su propio perfil + mismos de empresa; admin todo
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR empresa_id = public.current_user_empresa());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- USER ROLES: cada uno ve sus roles; admin todo
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CONFIGURACION: todos leen, admin modifica
CREATE POLICY "config_read_all" ON public.configuracion_limites FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_admin_update" ON public.configuracion_limites FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CATALOGOS
CREATE POLICY "cat_dep_read" ON public.catalogo_departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_dep_admin" ON public.catalogo_departamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cat_cat_read" ON public.catalogo_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_cat_admin" ON public.catalogo_categorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ORDENES
CREATE POLICY "ordenes_select" ON public.ordenes_pago FOR SELECT TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (
      empresa_id = public.current_user_empresa()
      AND (public.has_role(auth.uid(), 'verificador') OR public.has_role(auth.uid(), 'autorizador'))
    )
  );
CREATE POLICY "ordenes_insert_capturista" ON public.ordenes_pago FOR INSERT TO authenticated
  WITH CHECK (
    solicitante_id = auth.uid()
    AND (public.has_role(auth.uid(), 'capturista') OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "ordenes_update" ON public.ordenes_pago FOR UPDATE TO authenticated
  USING (
    (solicitante_id = auth.uid() AND status IN ('borrador','devuelta'))
    OR public.has_role(auth.uid(), 'admin')
    OR (
      empresa_id = public.current_user_empresa()
      AND (public.has_role(auth.uid(), 'verificador') OR public.has_role(auth.uid(), 'autorizador'))
    )
  );
CREATE POLICY "ordenes_delete_own_borrador" ON public.ordenes_pago FOR DELETE TO authenticated
  USING (
    (solicitante_id = auth.uid() AND status = 'borrador')
    OR public.has_role(auth.uid(), 'admin')
  );

-- HISTORIAL
CREATE POLICY "historial_select" ON public.orden_historial FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_pago o
      WHERE o.id = orden_id
      AND (
        o.solicitante_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (
          o.empresa_id = public.current_user_empresa()
          AND (public.has_role(auth.uid(), 'verificador') OR public.has_role(auth.uid(), 'autorizador'))
        )
      )
    )
  );
CREATE POLICY "historial_insert" ON public.orden_historial FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- AUTORIZACIONES
CREATE POLICY "autz_select" ON public.orden_autorizaciones FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ordenes_pago o WHERE o.id = orden_id
      AND (o.empresa_id = public.current_user_empresa() OR public.has_role(auth.uid(),'admin')))
  );
CREATE POLICY "autz_insert" ON public.orden_autorizaciones FOR INSERT TO authenticated
  WITH CHECK (autorizador_id = auth.uid() AND public.has_role(auth.uid(),'autorizador'));

-- ACUMULADO
CREATE POLICY "acum_select" ON public.acumulado_mensual_verificador FOR SELECT TO authenticated
  USING (
    verificador_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'autorizador')
  );
CREATE POLICY "acum_modify" ON public.acumulado_mensual_verificador FOR ALL TO authenticated
  USING (
    verificador_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    verificador_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- EMAIL LOG
CREATE POLICY "email_log_admin_read" ON public.email_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'autorizador'));

-- =========================================
-- STORAGE BUCKET para comprobantes
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "comprobantes_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "comprobantes_select_same_company" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'verificador')
      OR public.has_role(auth.uid(), 'autorizador')
    )
  );
CREATE POLICY "comprobantes_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "comprobantes_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
