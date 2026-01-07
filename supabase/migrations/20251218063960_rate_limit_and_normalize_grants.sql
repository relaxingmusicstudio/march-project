-- Grants for rate limiting and normalize_lead_atomic (idempotent)
DO $$
BEGIN
  IF to_regprocedure('public.check_and_increment_rate_limit(text, integer, integer)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO service_role;
  END IF;

  IF to_regprocedure('public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO service_role;
  END IF;
END $$;
