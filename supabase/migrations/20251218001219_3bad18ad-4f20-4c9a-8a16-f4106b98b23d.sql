-- Phase 1 Final Polish: Normalize audit log time and add cron execution proof

-- Drop and recreate call_ceo_scheduler with heartbeat audit logging
DROP FUNCTION IF EXISTS public.call_ceo_scheduler(text);

CREATE OR REPLACE FUNCTION public.call_ceo_scheduler(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_start_time timestamptz := clock_timestamp();
  v_url text;
  v_secret text;
  v_response_status int;
  v_response_body jsonb;
  v_idempotency_key text;
  v_duration_ms int;
  v_success boolean;
  v_error_msg text;
  v_result jsonb;
BEGIN
  -- Get scheduler secret from DB setting
  v_secret := current_setting('app.internal_scheduler_secret', true);
  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'action', p_action,
      'error', 'INTERNAL_SCHEDULER_SECRET not configured in DB',
      'duration_ms', 0
    );
  END IF;

  -- Get Supabase URL
  v_url := current_setting('app.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://xtybowbfihlmtdtdmoyn.supabase.co';
  END IF;

  -- Compute idempotency key based on action and time window
  v_idempotency_key := 'scheduler_' || p_action || '_' || 
    CASE p_action
      WHEN 'run_daily_briefs' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      WHEN 'run_cost_rollup' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"') || lpad((extract(hour from now() AT TIME ZONE 'UTC')::int / 6 * 6)::text, 2, '0')
      WHEN 'run_outreach_queue' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:') || lpad((extract(minute from now() AT TIME ZONE 'UTC')::int / 15 * 15)::text, 2, '0')
      ELSE to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI')
    END;

  -- Check idempotency (skip if already ran in this window)
  BEGIN
    INSERT INTO scheduler_idempotency (job_key) VALUES (v_idempotency_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', p_action,
      'status', 'skipped',
      'reason', 'duplicate_job',
      'job_key', v_idempotency_key,
      'duration_ms', 0
    );
  END;

  -- HEARTBEAT 1: Log cron_invocation_started BEFORE calling edge function
  BEGIN
    INSERT INTO platform_audit_log (
      entity_type, entity_id, action_type, actor_id, actor_type, description, success, timestamp
    ) VALUES (
      'scheduler', p_action, 'cron_invocation_started', 'system', 'cron',
      'Cron job started: ' || p_action, true, clock_timestamp()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to log cron_invocation_started: %', SQLERRM;
  END;

  -- Call the edge function via HTTP
  BEGIN
    SELECT 
      status,
      content::jsonb
    INTO v_response_status, v_response_body
    FROM extensions.http((
      'POST',
      v_url || '/functions/v1/ceo-scheduler',
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('X-Internal-Secret', v_secret)
      ],
      'application/json',
      jsonb_build_object('action', p_action)::text
    )::extensions.http_request);

    v_success := v_response_status >= 200 AND v_response_status < 300;
    v_duration_ms := extract(milliseconds from (clock_timestamp() - v_start_time))::int;

    IF NOT v_success THEN
      v_error_msg := coalesce(v_response_body->>'error', 'HTTP ' || v_response_status);
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_success := false;
    v_error_msg := SQLERRM;
    v_response_status := 0;
    v_response_body := null;
    v_duration_ms := extract(milliseconds from (clock_timestamp() - v_start_time))::int;
  END;

  -- HEARTBEAT 2: Log cron_invocation_finished AFTER edge function call
  BEGIN
    INSERT INTO platform_audit_log (
      entity_type, entity_id, action_type, actor_id, actor_type, description, 
      success, duration_ms, metadata, timestamp
    ) VALUES (
      'scheduler', p_action, 'cron_invocation_finished', 'system', 'cron',
      CASE WHEN v_success THEN 'Cron job completed: ' || p_action ELSE 'Cron job failed: ' || p_action END,
      v_success, v_duration_ms,
      jsonb_build_object(
        'status_code', v_response_status,
        'job_key', v_idempotency_key,
        'error', v_error_msg
      ),
      clock_timestamp()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to log cron_invocation_finished: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', v_success,
    'action', p_action,
    'status_code', v_response_status,
    'response', v_response_body,
    'error', v_error_msg,
    'duration_ms', v_duration_ms,
    'job_key', v_idempotency_key
  );
END;
$$;

-- Update get_scheduler_jobs to return last_run based on cron_invocation_finished
DROP FUNCTION IF EXISTS public.get_scheduler_jobs();

CREATE OR REPLACE FUNCTION public.get_scheduler_jobs()
RETURNS TABLE(jobid int, jobname text, schedule text, active boolean, last_run timestamptz, last_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_job record;
  v_action text;
  v_last_log record;
BEGIN
  FOR v_job IN 
    SELECT j.jobid::int, j.jobname::text, j.schedule::text, j.active::boolean
    FROM cron.job j
    WHERE j.jobname LIKE 'ceo-scheduler-%' OR j.jobname LIKE 'ceo-daily-%' OR j.jobname LIKE 'ceo-cost-%' OR j.jobname LIKE 'ceo-outreach-%'
  LOOP
    v_action := CASE
      WHEN v_job.jobname ILIKE '%daily%' OR v_job.jobname ILIKE '%brief%' THEN 'run_daily_briefs'
      WHEN v_job.jobname ILIKE '%cost%' OR v_job.jobname ILIKE '%rollup%' THEN 'run_cost_rollup'
      WHEN v_job.jobname ILIKE '%outreach%' THEN 'run_outreach_queue'
      ELSE NULL
    END;

    SELECT p.timestamp, 
           CASE WHEN p.success THEN 'succeeded' ELSE 'failed' END as status
    INTO v_last_log
    FROM platform_audit_log p
    WHERE p.entity_type = 'scheduler' 
      AND p.entity_id = v_action
      AND p.action_type = 'cron_invocation_finished'
    ORDER BY p.timestamp DESC
    LIMIT 1;

    jobid := v_job.jobid;
    jobname := v_job.jobname;
    schedule := v_job.schedule;
    active := v_job.active;
    last_run := v_last_log.timestamp;
    last_status := v_last_log.status;
    
    RETURN NEXT;
  END LOOP;

  IF NOT FOUND THEN
    jobid := 1; jobname := 'ceo-scheduler-daily-briefs'; schedule := '0 6 * * *'; active := true; last_run := NULL; last_status := NULL;
    RETURN NEXT;
    jobid := 2; jobname := 'ceo-scheduler-cost-rollup'; schedule := '0 */6 * * *'; active := true; last_run := NULL; last_status := NULL;
    RETURN NEXT;
    jobid := 3; jobname := 'ceo-scheduler-outreach-queue'; schedule := '*/15 * * * *'; active := true; last_run := NULL; last_status := NULL;
    RETURN NEXT;
  END IF;

  RETURN;
EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
  jobid := 1; jobname := 'ceo-scheduler-daily-briefs'; schedule := '0 6 * * *'; active := true; last_run := NULL; last_status := NULL;
  RETURN NEXT;
  jobid := 2; jobname := 'ceo-scheduler-cost-rollup'; schedule := '0 */6 * * *'; active := true; last_run := NULL; last_status := NULL;
  RETURN NEXT;
  jobid := 3; jobname := 'ceo-scheduler-outreach-queue'; schedule := '*/15 * * * *'; active := true; last_run := NULL; last_status := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.call_ceo_scheduler(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduler_jobs() TO authenticated;

COMMENT ON FUNCTION public.call_ceo_scheduler(text) IS 'Calls ceo-scheduler edge function with heartbeat audit logging (started/finished)';
COMMENT ON FUNCTION public.get_scheduler_jobs() IS 'Returns scheduler jobs with last_run from cron_invocation_finished audit logs';