-- ============================================================
-- SECURITY PATCHES: search_path hardening + move extensions
-- ============================================================

-- Harden touch_updated_at to use SECURITY INVOKER + explicit search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Move extensions out of public schema into dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector    SET SCHEMA extensions;
ALTER EXTENSION pg_trgm   SET SCHEMA extensions;
