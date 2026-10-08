create or replace function public.is_agrilink_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() #>> '{app_metadata,role}' = 'admin', false)
    or coalesce(auth.jwt() #>> '{app_metadata,is_admin}' = 'true', false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'suporteagrilink@gmail.com';
$$;

grant execute on function public.is_agrilink_admin() to anon, authenticated;
