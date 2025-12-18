-- Fix 1: Create lead_temperature as alias for lead_temperature_type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_temperature') THEN
    CREATE TYPE lead_temperature AS ENUM ('ice_cold', 'cold', 'warm', 'hot', 'booked', 'closed');
  END IF;
END $$;

-- Fix 2: Create rate limit tracking table for lead-normalize
CREATE TABLE IF NOT EXISTS public.lead_normalize_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index on rate_key for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_normalize_rate_limits_key 
ON public.lead_normalize_rate_limits(rate_key);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_lead_normalize_rate_limits_window 
ON public.lead_normalize_rate_limits(window_start);

-- Enable RLS but allow service role full access
ALTER TABLE public.lead_normalize_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy for service role (edge functions use service role)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.lead_normalize_rate_limits;
CREATE POLICY "Service role can manage rate limits" 
ON public.lead_normalize_rate_limits 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Fix 3: Create RPC for atomic rate limit check-and-increment
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_rate_key text,
  p_max_requests integer DEFAULT 20,
  p_window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - (p_window_seconds || ' seconds')::interval;
  v_current_count integer;
  v_allowed boolean;
  v_retry_after integer;
BEGIN
  -- Cleanup old entries (older than 2x window)
  DELETE FROM lead_normalize_rate_limits 
  WHERE window_start < v_now - (p_window_seconds * 2 || ' seconds')::interval;
  
  -- Atomic upsert with count increment
  INSERT INTO lead_normalize_rate_limits (rate_key, request_count, window_start)
  VALUES (p_rate_key, 1, v_now)
  ON CONFLICT (rate_key) DO UPDATE SET
    request_count = CASE 
      WHEN lead_normalize_rate_limits.window_start < v_window_start THEN 1
      ELSE lead_normalize_rate_limits.request_count + 1
    END,
    window_start = CASE 
      WHEN lead_normalize_rate_limits.window_start < v_window_start THEN v_now
      ELSE lead_normalize_rate_limits.window_start
    END
  RETURNING request_count INTO v_current_count;
  
  v_allowed := v_current_count <= p_max_requests;
  
  IF NOT v_allowed THEN
    -- Calculate retry_after based on when window resets
    SELECT EXTRACT(EPOCH FROM (window_start + (p_window_seconds || ' seconds')::interval - v_now))::integer
    INTO v_retry_after
    FROM lead_normalize_rate_limits
    WHERE rate_key = p_rate_key;
    
    v_retry_after := GREATEST(v_retry_after, 1);
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'max_requests', p_max_requests,
    'retry_after_seconds', COALESCE(v_retry_after, 0)
  );
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO service_role;

-- Fix 4: Update normalize_lead_atomic to use correct type
-- Drop and recreate with correct lead_temperature_type reference
CREATE OR REPLACE FUNCTION public.normalize_lead_atomic(
  p_tenant_id uuid, 
  p_email text DEFAULT NULL, 
  p_phone text DEFAULT NULL, 
  p_company_name text DEFAULT NULL, 
  p_first_name text DEFAULT NULL, 
  p_last_name text DEFAULT NULL, 
  p_job_title text DEFAULT NULL, 
  p_source text DEFAULT 'lead-normalize'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_fingerprint text;
  v_norm_email text;
  v_norm_phone text;
  v_segment text;
  v_lead_id uuid;
  v_profile_id uuid;
  v_status text;
  v_lead_name text;
  v_existing_enrichment jsonb;
  v_existing_sources text[];
  v_merged_sources text[];
  v_new_enrichment jsonb;
  v_is_new_profile boolean;
  v_error_code text;
  v_error_msg text;
BEGIN
  -- Normalize inputs
  v_norm_email := public.normalize_email(p_email);
  v_norm_phone := public.normalize_phone(p_phone);
  
  -- Compute fingerprint
  v_fingerprint := public.compute_lead_fingerprint(p_email, p_phone, p_company_name);
  
  -- Determine segment
  IF p_company_name IS NOT NULL OR p_job_title IS NOT NULL THEN
    v_segment := 'b2b';
  ELSIF v_norm_email IS NOT NULL 
    AND v_norm_email NOT LIKE '%@gmail.%' 
    AND v_norm_email NOT LIKE '%@yahoo.%' 
    AND v_norm_email NOT LIKE '%@hotmail.%' THEN
    v_segment := 'b2b';
  ELSIF v_norm_email IS NOT NULL OR v_norm_phone IS NOT NULL THEN
    v_segment := 'b2c';
  ELSE
    v_segment := 'unknown';
  END IF;

  BEGIN
    -- Step 1: Claim/create the profile row (unique invariant)
    INSERT INTO public.lead_profiles (
      lead_id,
      tenant_id,
      fingerprint,
      segment,
      temperature,
      company_name,
      job_title,
      is_primary,
      enrichment_data
    ) VALUES (
      NULL,
      p_tenant_id,
      v_fingerprint,
      v_segment::lead_segment,
      'ice_cold'::lead_temperature_type,
      p_company_name,
      p_job_title,
      true,
      jsonb_build_object(
        'sources', CASE WHEN p_source IS NOT NULL THEN jsonb_build_array(p_source) ELSE '[]'::jsonb END,
        'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    )
    ON CONFLICT (tenant_id, fingerprint) WHERE is_primary = true
    DO UPDATE SET updated_at = now()
    RETURNING id, (xmax = 0) AS is_new
    INTO v_profile_id, v_is_new_profile;

    IF v_is_new_profile THEN
      v_status := 'created';
      
      v_lead_name := NULLIF(TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, '')), '');
      IF v_lead_name IS NULL OR v_lead_name = '' THEN
        v_lead_name := 'Unknown';
      END IF;

      INSERT INTO public.leads (
        tenant_id, name, email, phone, business_name, source, status, lead_temperature, metadata
      ) VALUES (
        p_tenant_id, v_lead_name, v_norm_email, v_norm_phone, p_company_name, 
        COALESCE(p_source, 'lead-normalize'), 'new', 'cold',
        jsonb_build_object('normalized_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      )
      RETURNING id INTO v_lead_id;

      UPDATE public.lead_profiles
      SET lead_id = v_lead_id
      WHERE id = v_profile_id;

    ELSE
      v_status := 'deduped';
      
      SELECT lead_id, enrichment_data
      INTO v_lead_id, v_existing_enrichment
      FROM public.lead_profiles
      WHERE id = v_profile_id;

      v_existing_enrichment := COALESCE(v_existing_enrichment, '{}'::jsonb);
      
      IF jsonb_typeof(v_existing_enrichment->'sources') = 'array' THEN
        SELECT array_agg(elem::text) INTO v_existing_sources
        FROM jsonb_array_elements_text(v_existing_enrichment->'sources') AS elem;
      ELSE
        v_existing_sources := ARRAY[]::text[];
      END IF;
      
      IF p_source IS NOT NULL AND NOT (p_source = ANY(COALESCE(v_existing_sources, ARRAY[]::text[]))) THEN
        v_merged_sources := array_append(COALESCE(v_existing_sources, ARRAY[]::text[]), p_source);
      ELSE
        v_merged_sources := COALESCE(v_existing_sources, ARRAY[]::text[]);
      END IF;

      v_new_enrichment := v_existing_enrichment || jsonb_build_object(
        'last_seen_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'sources', to_jsonb(v_merged_sources)
      );

      UPDATE public.lead_profiles
      SET 
        enrichment_data = v_new_enrichment,
        company_name = COALESCE(lead_profiles.company_name, p_company_name),
        job_title = COALESCE(lead_profiles.job_title, p_job_title),
        segment = CASE 
          WHEN lead_profiles.segment = 'unknown' AND v_segment != 'unknown' THEN v_segment::lead_segment
          ELSE lead_profiles.segment 
        END,
        updated_at = now()
      WHERE id = v_profile_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_error_code := SQLSTATE;
    v_error_msg := SQLERRM;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_status,
    'lead_id', v_lead_id,
    'lead_profile_id', v_profile_id,
    'fingerprint', v_fingerprint,
    'segment', v_segment,
    'normalized', jsonb_build_object('email', v_norm_email, 'phone', v_norm_phone)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'normalize_failed',
    'error_code', SQLSTATE,
    'error_detail', SQLERRM,
    'fingerprint', LEFT(COALESCE(v_fingerprint, ''), 6)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO service_role;