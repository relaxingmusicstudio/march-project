-- Backfill owner role for existing tenant owners who don't have any role assigned
INSERT INTO public.user_roles (user_id, role)
SELECT t.owner_user_id, 'owner'::app_role
FROM public.tenants t
WHERE t.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.owner_user_id
  )
ON CONFLICT (user_id, role) DO NOTHING;