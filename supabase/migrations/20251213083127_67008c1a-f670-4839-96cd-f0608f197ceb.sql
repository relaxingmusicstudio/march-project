-- Ensure the has_role function is accessible via RPC
-- (It was created in the previous migration, but we need to make sure it's callable)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO anon;