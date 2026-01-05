-- Dev helper: expose to_regclass for client-side health checks
create or replace function public.db_to_regclass(p_name text)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select pg_catalog.to_regclass(p_name)::text;
$$;

grant execute on function public.db_to_regclass(text) to authenticated;
grant execute on function public.db_to_regclass(text) to anon;
