-- Ensure the has_role function is accessible via RPC (idempotent)
DO $$
BEGIN
  IF to_regtype('public.app_role') IS NOT NULL
     AND to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon;
  END IF;
END $$;
