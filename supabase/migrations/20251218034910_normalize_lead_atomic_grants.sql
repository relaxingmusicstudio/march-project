-- Grants for normalize_lead_atomic (service_role only)
DO $$
BEGIN
  IF to_regprocedure('public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO service_role;
  END IF;
END $$;
