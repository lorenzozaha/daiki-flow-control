
-- Fix search_path on trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke direct EXECUTE on helper/trigger functions from public/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role and current_user_empresa MUST remain executable by authenticated
-- because they are used inside RLS policies. That's the intended design.
-- Revoke from anon to tighten surface.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_empresa() FROM anon;
