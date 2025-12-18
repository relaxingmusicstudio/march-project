-- Batch 2.2 Hardening: Profile-first atomic flow (no orphans possible)
-- Revoke authenticated, keep only service_role

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
SET search_path = public
SET row_security = off
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

  -- PROFILE-FIRST APPROACH: Claim/create the profile row first (the unique invariant)
  -- This ensures no orphan leads can ever be created
  INSERT INTO public.lead_profiles (
    lead_id,  -- NULL initially for new profiles
    tenant_id,
    fingerprint,
    segment,
    temperature,
    company_name,
    job_title,
    is_primary,
    enrichment_data
  ) VALUES (
    NULL,  -- lead_id set later if this is a new profile
    p_tenant_id,
    v_fingerprint,
    v_segment::lead_segment,
    'ice_cold'::lead_temperature,
    p_company_name,
    p_job_title,
    true,
    jsonb_build_object(
      'sources', CASE WHEN p_source IS NOT NULL THEN jsonb_build_array(p_source) ELSE '[]'::jsonb END,
      'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  )
  ON CONFLICT (tenant_id, fingerprint) WHERE is_primary = true
  DO UPDATE SET
    updated_at = now()  -- Just touch timestamp to detect conflict
  RETURNING id, (xmax = 0) AS is_new
  INTO v_profile_id, v_is_new_profile;

  IF v_is_new_profile THEN
    -- NEW PROFILE PATH: Create lead, then link it to the profile
    v_status := 'created';
    
    v_lead_name := NULLIF(TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, '')), '');
    IF v_lead_name IS NULL OR v_lead_name = '' THEN
      v_lead_name := 'Unknown';
    END IF;

    -- Insert lead
    INSERT INTO public.leads (
      tenant_id, name, email, phone, business_name, source, status, lead_temperature, metadata
    ) VALUES (
      p_tenant_id, v_lead_name, v_norm_email, v_norm_phone, p_company_name, 
      COALESCE(p_source, 'lead-normalize'), 'new', 'cold',
      jsonb_build_object('normalized_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    )
    RETURNING id INTO v_lead_id;

    -- Link lead to profile (profile was created with NULL lead_id)
    UPDATE public.lead_profiles
    SET lead_id = v_lead_id
    WHERE id = v_profile_id;

  ELSE
    -- DEDUP PATH: Profile already exists, update enrichment
    v_status := 'deduped';
    
    -- Get existing profile data
    SELECT lead_id, enrichment_data
    INTO v_lead_id, v_existing_enrichment
    FROM public.lead_profiles
    WHERE id = v_profile_id;

    v_existing_enrichment := COALESCE(v_existing_enrichment, '{}'::jsonb);
    
    -- Extract existing sources safely
    IF jsonb_typeof(v_existing_enrichment->'sources') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_existing_sources
      FROM jsonb_array_elements_text(v_existing_enrichment->'sources') AS elem;
    ELSE
      v_existing_sources := ARRAY[]::text[];
    END IF;
    
    -- Merge sources (dedupe)
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
  -- Return error without leaking PII
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'normalize_failed',
    'error_code', SQLSTATE,
    'fingerprint', LEFT(COALESCE(v_fingerprint, ''), 6)
  );
END;
$$;

-- Least privilege: only service_role can execute
REVOKE EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_lead_atomic(uuid, text, text, text, text, text, text, text) TO service_role;