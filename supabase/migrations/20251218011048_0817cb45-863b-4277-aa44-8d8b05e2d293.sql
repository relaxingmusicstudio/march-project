-- ============================================================================
-- BATCH 2.1 FINAL HARDENING: Production-safe lead normalization
-- ============================================================================

-- 1) Ensure pgcrypto extension for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- FUNCTION SIGNATURES (for reference):
-- public.normalize_email(raw_email text) RETURNS text
-- public.normalize_phone(raw_phone text) RETURNS text  
-- public.compute_lead_fingerprint(p_email text, p_phone text, p_company_name text) RETURNS text
-- ============================================================================

-- 2) Fix normalize_email with proper search_path
CREATE OR REPLACE FUNCTION public.normalize_email(raw_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF raw_email IS NULL OR raw_email = '' THEN
    RETURN NULL;
  END IF;
  RETURN LOWER(TRIM(raw_email));
END;
$$;

-- 3) Fix normalize_phone with proper search_path
CREATE OR REPLACE FUNCTION public.normalize_phone(raw_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits_only text;
BEGIN
  IF raw_phone IS NULL OR raw_phone = '' THEN
    RETURN NULL;
  END IF;
  digits_only := regexp_replace(raw_phone, '[^0-9]', '', 'g');
  IF length(digits_only) >= 10 THEN
    RETURN RIGHT(digits_only, 10);
  END IF;
  RETURN digits_only;
END;
$$;

-- 4) Fix compute_lead_fingerprint to use pgcrypto digest() instead of sha256()
CREATE OR REPLACE FUNCTION public.compute_lead_fingerprint(
  p_email text,
  p_phone text,
  p_company_name text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  norm_email text;
  norm_phone text;
  norm_company text;
  fingerprint_raw text;
BEGIN
  norm_email := public.normalize_email(p_email);
  norm_phone := public.normalize_phone(p_phone);
  norm_company := LOWER(TRIM(COALESCE(p_company_name, '')));
  fingerprint_raw := COALESCE(norm_email, '') || '|' || COALESCE(norm_phone, '') || '|' || norm_company;
  -- Use pgcrypto digest() for SHA256 hashing
  RETURN LEFT(encode(digest(fingerprint_raw, 'sha256'), 'hex'), 32);
END;
$$;

-- 5) Fix RLS policies (remove tenant_id IS NULL bypass, use proper tenant isolation)
DROP POLICY IF EXISTS "Tenant isolation for lead_profiles" ON public.lead_profiles;
DROP POLICY IF EXISTS "Admins can manage lead_profiles" ON public.lead_profiles;
DROP POLICY IF EXISTS "Service role full access lead_profiles" ON public.lead_profiles;

-- Strict tenant isolation
CREATE POLICY "Tenant isolation for lead_profiles"
  ON public.lead_profiles
  FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Admin override
CREATE POLICY "Admins can manage lead_profiles"
  ON public.lead_profiles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6) Tighten permissions
REVOKE ALL ON public.lead_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_profiles TO authenticated;
GRANT ALL ON public.lead_profiles TO service_role;

-- 7) Fix audit trigger with safe column handling
CREATE OR REPLACE FUNCTION public.audit_lead_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type_val text;
  metadata_val jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type_val := 'lead_profile_created';
    metadata_val := jsonb_build_object(
      'tenant_id', NEW.tenant_id,
      'lead_id', NEW.lead_id,
      'fingerprint', NEW.fingerprint,
      'segment', NEW.segment::text,
      'is_primary', NEW.is_primary
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF array_length(NEW.merged_from, 1) > COALESCE(array_length(OLD.merged_from, 1), 0) THEN
      action_type_val := 'lead_profile_merged';
      metadata_val := jsonb_build_object(
        'tenant_id', NEW.tenant_id,
        'lead_id', NEW.lead_id,
        'fingerprint', NEW.fingerprint,
        'merged_from', to_jsonb(NEW.merged_from),
        'previous_merged_from', to_jsonb(OLD.merged_from)
      );
    ELSE
      action_type_val := 'lead_profile_updated';
      metadata_val := jsonb_build_object(
        'tenant_id', NEW.tenant_id,
        'lead_id', NEW.lead_id,
        'fingerprint', NEW.fingerprint,
        'segment', NEW.segment::text
      );
    END IF;
  END IF;
  
  -- Insert audit log (only use columns that exist in platform_audit_log)
  INSERT INTO public.platform_audit_log (
    tenant_id, timestamp, agent_name, action_type, entity_type, entity_id,
    description, request_snapshot, success
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    clock_timestamp(),
    'lead-normalizer',
    action_type_val,
    'lead_profile',
    COALESCE(NEW.id, OLD.id)::text,
    action_type_val || ' for fingerprint: ' || COALESCE(NEW.fingerprint, OLD.fingerprint),
    metadata_val,
    true
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;