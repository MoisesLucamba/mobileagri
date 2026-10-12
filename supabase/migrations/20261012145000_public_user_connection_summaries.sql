drop policy if exists "Users can read their own connections" on public.user_connections;
drop policy if exists "Authenticated users can view connection counts" on public.user_connections;
create policy "Authenticated users can view connection counts"
  on public.user_connections for select to authenticated
  using (true);
