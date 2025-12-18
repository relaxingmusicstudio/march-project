-- Batch 2.1 Extra Production Protection (Idempotent)
-- Created: 2024-12-18

-- ============================================================
-- A1) Ensure pgcrypto extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- A6) Create is_platform_admin() helper (if not exists)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'platform_admin'
  );
$$;

-- ============================================================
-- A2) RPC-safe function wrappers - ensure EXACT param names
-- ============================================================

-- normalize_email with exact param name raw_email
CREATE OR REPLACE FUNCTION public.normalize_email(raw_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF raw_email IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(trim(raw_email));
END;
$$;

-- A3) normalize_phone with exact param name raw_phone and correct 10-digit logic
CREATE OR REPLACE FUNCTION public.normalize_phone(raw_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  len int;
BEGIN
  IF raw_phone IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Strip all non-digit characters
  digits := regexp_replace(raw_phone, '[^0-9]', '', 'g');
  len := length(digits);
  
  -- If 11 digits starting with 1, return last 10
  IF len = 11 AND left(digits, 1) = '1' THEN
    RETURN right(digits, 10);
  END IF;
  
  -- If more than 10 digits, return last 10
  IF len > 10 THEN
    RETURN right(digits, 10);
  END IF;
  
  -- Otherwise return digits as-is (including <10 digit numbers)
  RETURN digits;
END;
$$;

-- ============================================================
-- A4) compute_lead_fingerprint using pgcrypto (NULL-safe)
-- ============================================================
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
  v_email text;
  v_phone text;
  v_company text;
  v_raw text;
BEGIN
  v_email := COALESCE(public.normalize_email(p_email), '');
  v_phone := COALESCE(public.normalize_phone(p_phone), '');
  v_company := COALESCE(lower(trim(p_company_name)), '');
  v_raw := v_email || '|' || v_phone || '|' || v_company;
  RETURN LEFT(encode(digest(v_raw, 'sha256'), 'hex'), 32);
END;
$$;

-- ============================================================
-- A5) Unique partial index for dedupe invariant (race-proof)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS lead_profiles_one_primary_per_fingerprint
ON public.lead_profiles (tenant_id, fingerprint)
WHERE is_primary = true;

-- ============================================================
-- A6) RLS policies for lead_profiles
-- ============================================================

-- Enable RLS if not already
ALTER TABLE public.lead_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent recreation)
DROP POLICY IF EXISTS lead_profiles_tenant_select ON public.lead_profiles;
DROP POLICY IF EXISTS lead_profiles_tenant_insert ON public.lead_profiles;
DROP POLICY IF EXISTS lead_profiles_tenant_update ON public.lead_profiles;
DROP POLICY IF EXISTS lead_profiles_service_role_all ON public.lead_profiles;
DROP POLICY IF EXISTS lead_profiles_admin_all ON public.lead_profiles;

-- Strict tenant isolation for authenticated users
CREATE POLICY lead_profiles_tenant_select ON public.lead_profiles
FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY lead_profiles_tenant_insert ON public.lead_profiles
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY lead_profiles_tenant_update ON public.lead_profiles
FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Service role bypass (for edge functions)
CREATE POLICY lead_profiles_service_role_all ON public.lead_profiles
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Platform admin bypass
CREATE POLICY lead_profiles_admin_all ON public.lead_profiles
FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ============================================================
-- A7) request_nonces replay protection table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.request_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_nonces_nonce_unique UNIQUE (nonce)
);

-- Enable RLS
ALTER TABLE public.request_nonces ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS request_nonces_service_role_all ON public.request_nonces;
CREATE POLICY request_nonces_service_role_all ON public.request_nonces
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Index for cleanup jobs
CREATE INDEX IF NOT EXISTS request_nonces_created_at_idx 
ON public.request_nonces (created_at);

-- ============================================================
-- A8) Audit trigger with safety (SECURITY DEFINER, COALESCE guards)
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_lead_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type text;
  v_old_merged_count int;
  v_new_merged_count int;
BEGIN
  v_old_merged_count := COALESCE(array_length(OLD.merged_from, 1), 0);
  v_new_merged_count := COALESCE(array_length(NEW.merged_from, 1), 0);

  IF TG_OP = 'INSERT' THEN
    v_action_type := 'lead_profile_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_new_merged_count > v_old_merged_count THEN
      v_action_type := 'lead_profile_merged';
    ELSE
      v_action_type := 'lead_profile_updated';
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  -- Silent insert with guaranteed columns only, cast entity_id to text
  BEGIN
    INSERT INTO public.platform_audit_log (
      tenant_id, timestamp, agent_name, action_type, entity_type,
      entity_id, description, request_snapshot, success
    ) VALUES (
      NEW.tenant_id, clock_timestamp(), 'lead_profile_trigger', v_action_type, 'lead_profile',
      NEW.id::text, v_action_type || ': ' || COALESCE(NEW.fingerprint, 'no-fp'),
      jsonb_build_object('fp', left(NEW.fingerprint, 6), 'seg', NEW.segment, 'pri', NEW.is_primary),
      true
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silent failure - do not RAISE WARNING (noise + potential leakage)
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_audit_lead_profile_changes ON public.lead_profiles;
CREATE TRIGGER trg_audit_lead_profile_changes
  AFTER INSERT OR UPDATE ON public.lead_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_lead_profile_changes();

-- ============================================================
-- Grant execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.compute_lead_fingerprint(text, text, text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;