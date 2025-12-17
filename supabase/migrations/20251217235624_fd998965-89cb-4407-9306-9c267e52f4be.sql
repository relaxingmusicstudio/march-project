-- Drop existing function with old signature
DROP FUNCTION IF EXISTS public.get_scheduler_jobs();

-- RPC function to get scheduler jobs from cron schema
-- Uses SECURITY DEFINER to access cron schema which is not exposed via PostgREST

CREATE OR REPLACE FUNCTION public.get_scheduler_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  -- Try to read from cron.job if pg_cron is installed
  BEGIN
    RETURN QUERY
    SELECT 
      j.jobid,
      j.jobname,
      j.schedule,
      j.active
    FROM cron.job j
    WHERE j.jobname IN (
      'ceo-daily-briefs',
      'ceo-cost-rollup', 
      'ceo-outreach-queue'
    )
    ORDER BY j.jobname;
  EXCEPTION 
    WHEN undefined_table THEN
      -- cron.job doesn't exist, return empty
      RETURN;
    WHEN insufficient_privilege THEN
      -- No access to cron schema, return empty
      RETURN;
  END;
END;
$$;

-- Grant execute to authenticated users (edge function uses service role anyway)
GRANT EXECUTE ON FUNCTION public.get_scheduler_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduler_jobs() TO service_role;

COMMENT ON FUNCTION public.get_scheduler_jobs() IS 'Returns pg_cron scheduler jobs for CEO scheduler. SECURITY DEFINER to access cron schema.';