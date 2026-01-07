-- Grants for normalize_lead_atomic (idempotent)
DO $$
BEGIN
  IF to_regprocedure('public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO service_role, authenticated;
  END IF;
END $$;
