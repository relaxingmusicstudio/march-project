-- ============================================================================
-- Batch 2.1 Final Production-Proof Migration
-- Ensures pgcrypto, stable function signatures, strict RLS, and proper grants
-- ============================================================================

-- 1) Enable pgcrypto extension for fingerprint hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Create/replace normalize_email with stable signature: raw_email text
-- This is the canonical signature for RPC compatibility
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

-- 3) Create/replace normalize_phone with stable signature: raw_phone text
-- Keeps last 10 digits for US phone normalization
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

-- 4) Create/replace compute_lead_fingerprint with stable signature
-- Uses pgcrypto digest() for SHA256 hashing
-- Signature: p_email text, p_phone text, p_company_name text
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

-- 5) Add comments documenting the exact function signatures for reference
COMMENT ON FUNCTION public.normalize_email(text) IS 
'Normalizes email to lowercase trimmed. Signature: normalize_email(raw_email text) -> text';

COMMENT ON FUNCTION public.normalize_phone(text) IS 
'Normalizes phone to last 10 digits. Signature: normalize_phone(raw_phone text) -> text';

COMMENT ON FUNCTION public.compute_lead_fingerprint(text, text, text) IS 
'Computes SHA256 fingerprint from email|phone|company. Signature: compute_lead_fingerprint(p_email text, p_phone text, p_company_name text) -> text';

-- 6) Tighten RLS policies for lead_profiles
-- Remove any permissive policies and enforce strict tenant isolation

-- Drop existing policies to recreate with correct rules
DROP POLICY IF EXISTS "Users can view lead_profiles in their tenant" ON public.lead_profiles;
DROP POLICY IF EXISTS "Users can insert lead_profiles in their tenant" ON public.lead_profiles;
DROP POLICY IF EXISTS "Users can update lead_profiles in their tenant" ON public.lead_profiles;
DROP POLICY IF EXISTS "Platform admins can manage all lead_profiles" ON public.lead_profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.lead_profiles;
DROP POLICY IF EXISTS "lead_profiles_tenant_isolation" ON public.lead_profiles;
DROP POLICY IF EXISTS "lead_profiles_tenant_insert" ON public.lead_profiles;
DROP POLICY IF EXISTS "lead_profiles_tenant_update" ON public.lead_profiles;
DROP POLICY IF EXISTS "lead_profiles_admin_access" ON public.lead_profiles;

-- Ensure RLS is enabled
ALTER TABLE public.lead_profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users: strict tenant isolation for SELECT
CREATE POLICY "lead_profiles_tenant_select"
ON public.lead_profiles
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- Authenticated users: strict tenant isolation for INSERT
CREATE POLICY "lead_profiles_tenant_insert"
ON public.lead_profiles
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Authenticated users: strict tenant isolation for UPDATE
CREATE POLICY "lead_profiles_tenant_update"
ON public.lead_profiles
FOR UPDATE
TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Platform admins: can access all tenants (uses is_platform_admin function)
CREATE POLICY "lead_profiles_platform_admin_access"
ON public.lead_profiles
FOR ALL
TO authenticated
USING (public.is_platform_admin() = true)
WITH CHECK (public.is_platform_admin() = true);

-- 7) Set proper permissions
REVOKE ALL ON public.lead_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_profiles TO authenticated;
GRANT ALL ON public.lead_profiles TO service_role;

-- 8) Update audit trigger to be more robust
CREATE OR REPLACE FUNCTION public.audit_lead_profile_changes()
RETURNS trigger
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
  
  -- Insert audit log safely (only use columns that definitely exist)
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

-- Ensure trigger exists
DROP TRIGGER IF EXISTS audit_lead_profile_changes_trigger ON public.lead_profiles;
CREATE TRIGGER audit_lead_profile_changes_trigger
AFTER INSERT OR UPDATE ON public.lead_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_lead_profile_changes();