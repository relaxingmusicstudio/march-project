-- Fix permissions for lead normalization RPCs (idempotent)
DO $$
BEGIN
  IF to_regprocedure('public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO anon;
  END IF;

  IF to_regprocedure('public.compute_lead_fingerprint(text, text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.compute_lead_fingerprint(text, text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.compute_lead_fingerprint(text, text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.compute_lead_fingerprint(text, text, text) TO anon;
  END IF;

  IF to_regprocedure('public.normalize_email(text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO anon;
  END IF;

  IF to_regprocedure('public.normalize_phone(text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO anon;
  END IF;

  IF to_regprocedure('public.check_and_increment_rate_limit(text, integer, integer)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO anon;
  END IF;

  IF to_regclass('public.lead_profiles') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.lead_profiles TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON public.lead_profiles TO service_role;
  END IF;

  IF to_regclass('public.lead_normalize_rate_limits') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_normalize_rate_limits TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_normalize_rate_limits TO service_role;
  END IF;

  IF to_regclass('public.leads') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON public.leads TO service_role;
  END IF;
END $$;
