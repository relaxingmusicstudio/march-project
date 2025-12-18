-- Batch 2.1 has_role hardening + permissions (idempotent)
DO $do$
BEGIN
  -- Revoke PUBLIC from both overloads (if present)
  IF to_regprocedure('public.has_role(uuid, text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC';
  END IF;

  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC';
  END IF;
END;
$do$;

-- Ensure the text overload remains hardened and restricted
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  );
$$;

-- If legacy enum overload exists, keep compatibility but harden it by delegating to text overload
DO $do$
BEGIN
  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $fn$
        SELECT public.has_role(_user_id, _role::text)
      $fn$;
    $sql$;
  END IF;
END;
$do$;

-- Grant only to authenticated + service_role (both overloads if they exist)
DO $do$
BEGIN
  IF to_regprocedure('public.has_role(uuid, text)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public.has_role(uuid, public.app_role)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role';
  END IF;
END;
$do$;