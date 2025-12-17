-- RPC function to ensure user has a role, assigning default if missing
-- Returns the user's role after ensuring it exists
CREATE OR REPLACE FUNCTION public.ensure_user_role(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_is_tenant_owner boolean;
BEGIN
  -- First check if user already has a role
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'owner' THEN 2 
      WHEN 'moderator' THEN 3 
      WHEN 'client' THEN 4
      WHEN 'user' THEN 5
    END
  LIMIT 1;

  -- If role exists, return it
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Check if user is a tenant owner
  SELECT EXISTS (
    SELECT 1 FROM public.tenants 
    WHERE owner_user_id = _user_id
  ) INTO v_is_tenant_owner;

  -- Assign appropriate role
  IF v_is_tenant_owner THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN 'owner';
  ELSE
    -- Default to client for non-owners
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'client')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN 'client';
  END IF;
END;
$$;