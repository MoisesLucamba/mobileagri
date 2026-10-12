create table if not exists public.user_connections (
  viewer_id uuid not null references auth.users(id) on delete cascade,
  connected_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, connected_user_id),
  constraint user_connections_not_self check (viewer_id <> connected_user_id)
);

create index if not exists user_connections_connected_user_idx
  on public.user_connections (connected_user_id, viewer_id);

alter table public.user_connections enable row level security;

drop policy if exists "Users can read their own connections" on public.user_connections;
drop policy if exists "Authenticated users can view connection counts" on public.user_connections;
create policy "Authenticated users can view connection counts"
  on public.user_connections for select to authenticated
  using (true);

drop policy if exists "Users can connect themselves" on public.user_connections;
create policy "Users can connect themselves"
  on public.user_connections for insert to authenticated
  with check (viewer_id = (select auth.uid()));

drop policy if exists "Users can remove their own connections" on public.user_connections;
create policy "Users can remove their own connections"
  on public.user_connections for delete to authenticated
  using (viewer_id = (select auth.uid()));

grant select, insert, delete on public.user_connections to authenticated;
