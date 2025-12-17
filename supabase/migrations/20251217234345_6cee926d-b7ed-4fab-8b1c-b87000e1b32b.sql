-- Phase 1 Scheduler - Functions Only

-- Enhanced call_ceo_scheduler with audit logging
CREATE OR REPLACE FUNCTION public.call_ceo_scheduler(
  p_action text,
  p_tenant_ids text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_secret text;
  v_url text;
  v_body jsonb;
  v_request_id bigint;
BEGIN
  v_secret := current_setting('app.internal_scheduler_secret', true);
  
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE '[ceo-scheduler cron] INTERNAL_SCHEDULER_SECRET not configured. Skipping action: %', p_action;
    INSERT INTO platform_audit_log (action_type, entity_type, entity_id, description, success)
    VALUES ('cron_trigger', 'scheduler', p_action, 'Skipped: secret not configured', false);
    RETURN;
  END IF;
  
  v_url := 'https://xtybowbfihlmtdtdmoyn.supabase.co/functions/v1/ceo-scheduler';
  v_body := jsonb_build_object('action', p_action);
  IF p_tenant_ids IS NOT NULL THEN
    v_body := v_body || jsonb_build_object('tenant_ids', p_tenant_ids);
  END IF;
  
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', v_secret
    ),
    body := v_body
  ) INTO v_request_id;
  
  INSERT INTO platform_audit_log (action_type, entity_type, entity_id, description, request_snapshot, success)
  VALUES (
    'cron_trigger', 'scheduler', p_action, 
    format('Cron triggered action: %s', p_action),
    jsonb_build_object('request_id', v_request_id, 'tenant_ids', p_tenant_ids),
    true
  );
  
  RAISE NOTICE '[ceo-scheduler cron] Triggered action=% request_id=%', p_action, v_request_id;
END;
$function$;

-- RPC to check scheduler secret status
CREATE OR REPLACE FUNCTION public.check_scheduler_secret_configured()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT current_setting('app.internal_scheduler_secret', true) IS NOT NULL 
     AND current_setting('app.internal_scheduler_secret', true) != '';
$function$;

GRANT EXECUTE ON FUNCTION public.check_scheduler_secret_configured() TO authenticated;

-- RPC to get scheduler job status (using correct column names)
CREATE OR REPLACE FUNCTION public.get_scheduler_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run timestamptz,
  last_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $function$
  SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    (SELECT MAX(start_time) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) as last_run,
    (SELECT status FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid ORDER BY start_time DESC LIMIT 1) as last_status
  FROM cron.job j
  WHERE j.jobname LIKE 'ceo-scheduler%'
  ORDER BY j.jobname;
$function$;

GRANT EXECUTE ON FUNCTION public.get_scheduler_jobs() TO authenticated;