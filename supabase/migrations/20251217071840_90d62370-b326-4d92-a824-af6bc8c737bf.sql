-- Create helper function to check user's primary role (using committed enum values)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
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
  LIMIT 1
$$;

-- Assign 'owner' role to tenant owners automatically
CREATE OR REPLACE FUNCTION public.assign_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a tenant is created, assign owner role to the owner_user_id
  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.owner_user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_tenant_created_assign_owner') THEN
    CREATE TRIGGER on_tenant_created_assign_owner
      AFTER INSERT ON public.tenants
      FOR EACH ROW
      EXECUTE FUNCTION public.assign_owner_role();
  END IF;
END
$$;