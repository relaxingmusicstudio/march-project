-- Phase 1 Finalize Part 2: Fix call_ceo_scheduler return type and create cron jobs

-- Drop ALL existing overloads first
DROP FUNCTION IF EXISTS public.call_ceo_scheduler(text, text[]);
DROP FUNCTION IF EXISTS public.call_ceo_scheduler(text) CASCADE;

-- Recreate with JSONB return type
CREATE FUNCTION public.call_ceo_scheduler(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_secret text;
  v_url text;
  v_start_ts timestamptz := clock_timestamp();
  v_request_id bigint;
  v_idempotency_key text;
  v_result jsonb;
  v_status_code int := 0;
  v_error text := NULL;
  v_duration_ms int;
BEGIN
  -- Build idempotency key with 5-minute window
  v_idempotency_key := p_action || '_' || to_char(date_trunc('hour', now()) + 
    (floor(extract(minute from now()) / 5) * interval '5 minutes'), 'YYYY-MM-DD_HH24-MI');

  -- Check idempotency
  BEGIN
    INSERT INTO public.scheduler_idempotency (job_key, created_at)
    VALUES (v_idempotency_key, now());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', true, 'action', p_action, 'status_code', 0, 'skipped', true,
      'reason', 'idempotency_key_exists', 'idempotency_key', v_idempotency_key, 'duration_ms', 0
    );
  END;

  -- Get secret from DB setting
  v_secret := current_setting('app.internal_scheduler_secret', true);
  
  IF v_secret IS NULL OR v_secret = '' THEN
    v_error := 'INTERNAL_SCHEDULER_SECRET not configured';
    BEGIN
      INSERT INTO public.platform_audit_log (action_type, entity_type, entity_id, description, success, error_message, duration_ms)
      VALUES ('cron_trigger', 'scheduler', p_action, 'Secret not configured', false, v_error, 0);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object('ok', false, 'action', p_action, 'status_code', 0, 'error', v_error, 'duration_ms', 0);
  END IF;

  -- Call edge function
  v_url := 'https://xtybowbfihlmtdtdmoyn.supabase.co/functions/v1/ceo-scheduler';
  
  BEGIN
    SELECT net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Internal-Secret', v_secret),
      body := jsonb_build_object('action', p_action)
    ) INTO v_request_id;
    v_status_code := 200;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    v_status_code := 500;
  END;
  
  v_duration_ms := extract(millisecond from (clock_timestamp() - v_start_ts))::int;
  
  v_result := jsonb_build_object(
    'ok', v_error IS NULL, 'action', p_action, 'status_code', v_status_code,
    'request_id', v_request_id, 'error', v_error, 'duration_ms', v_duration_ms, 'idempotency_key', v_idempotency_key
  );

  -- Audit log (non-blocking)
  BEGIN
    INSERT INTO public.platform_audit_log (action_type, entity_type, entity_id, description, success, error_message, duration_ms, request_snapshot)
    VALUES ('cron_trigger', 'scheduler', p_action, format('Cron triggered %s', p_action), v_error IS NULL, v_error, v_duration_ms,
      jsonb_build_object('request_id', v_request_id, 'idempotency_key', v_idempotency_key));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
    
  RETURN v_result;
END;
$fn$;

-- Ensure unique constraint exists
ALTER TABLE public.scheduler_idempotency DROP CONSTRAINT IF EXISTS scheduler_idempotency_job_key_key;
ALTER TABLE public.scheduler_idempotency ADD CONSTRAINT scheduler_idempotency_job_key_key UNIQUE (job_key);

-- Clean old idempotency keys
DELETE FROM public.scheduler_idempotency WHERE created_at < now() - interval '1 day';