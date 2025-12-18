-- Update get_scheduler_jobs to use existing job names
CREATE OR REPLACE FUNCTION public.get_scheduler_jobs()
RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  BEGIN
    RETURN QUERY
    SELECT 
      j.jobid,
      j.jobname,
      j.schedule,
      j.active
    FROM cron.job j
    WHERE j.jobname IN (
      'ceo-scheduler-daily-briefs',
      'ceo-scheduler-cost-rollup', 
      'ceo-scheduler-outreach-queue',
      'ceo-daily-briefs',
      'ceo-cost-rollup',
      'ceo-outreach-queue'
    )
    ORDER BY j.jobname;
  EXCEPTION 
    WHEN undefined_table THEN
      RETURN;
    WHEN insufficient_privilege THEN
      RETURN;
  END;
END;
$$;