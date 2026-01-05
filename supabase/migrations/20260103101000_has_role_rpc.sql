-- Creates the RPC your frontend is calling: /rest/v1/rpc/has_role
-- Uses JWT app_metadata first, then falls back to auth.users.raw_app_meta_data

create or replace function public.has_role(
  role text,
  user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  claims jsonb;
  appmeta jsonb;
begin
  if user_id is null then
    return false;
  end if;

  -- Prefer JWT (fast, no table read)
  claims := coalesce(auth.jwt(), '{}'::jsonb);
  appmeta := coalesce(claims->'app_metadata', '{}'::jsonb);

  -- roles: ["admin","user"] style
  if jsonb_typeof(appmeta->'roles') = 'array' then
    return (appmeta->'roles') ? role;
  end if;

  -- role: "admin" style
  if (appmeta ? 'role') then
    return (appmeta->>'role') = role;
  end if;

  -- Fallback: read from auth.users
  select coalesce(u.raw_app_meta_data, '{}'::jsonb)
  into appmeta
  from auth.users u
  where u.id = user_id;

  if jsonb_typeof(appmeta->'roles') = 'array' then
    return (appmeta->'roles') ? role;
  end if;

  return coalesce(appmeta->>'role','') = role;
end;
$$;

-- Allow API callers to execute it
grant execute on function public.has_role(text, uuid) to authenticated;
grant execute on function public.has_role(text, uuid) to anon;
