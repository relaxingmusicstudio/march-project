-- Fix compute_lead_fingerprint to use extensions.digest explicitly
CREATE OR REPLACE FUNCTION public.compute_lead_fingerprint(p_email text, p_phone text, p_company_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $function$
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
  RETURN LEFT(encode(extensions.digest(v_raw::bytea, 'sha256'), 'hex'), 32);
END;
$function$;