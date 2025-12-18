-- Scheduler Idempotency table (if not exists)
CREATE TABLE IF NOT EXISTS public.scheduler_idempotency (
  job_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_scheduler_idempotency_created_at 
  ON public.scheduler_idempotency(created_at);

-- RLS: Only service role can access
ALTER TABLE public.scheduler_idempotency ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role only" ON public.scheduler_idempotency;

-- Create policy for service role access
CREATE POLICY "Service role only" ON public.scheduler_idempotency
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Grant to service role (handled by Supabase automatically via bypassing RLS)

-- Update get_scheduler_jobs to be more robust
CREATE OR REPLACE FUNCTION public.get_scheduler_jobs()
RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean)
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

-- Update check_scheduler_secret_configured for robustness
CREATE OR REPLACE FUNCTION public.check_scheduler_secret_configured()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('app.internal_scheduler_secret', true) IS NOT NULL 
     AND current_setting('app.internal_scheduler_secret', true) != '';
$$;

-- Grant execute to authenticated only
REVOKE ALL ON FUNCTION public.get_scheduler_jobs() FROM public;
GRANT EXECUTE ON FUNCTION public.get_scheduler_jobs() TO authenticated;

REVOKE ALL ON FUNCTION public.check_scheduler_secret_configured() FROM public;
GRANT EXECUTE ON FUNCTION public.check_scheduler_secret_configured() TO authenticated;