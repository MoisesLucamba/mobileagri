alter table public.users
  add column if not exists cover_url text;

grant update (cover_url) on public.users to authenticated;

drop policy if exists "Users can update own profile cover" on public.users;
create policy "Users can update own profile cover"
  on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view profile images" on storage.objects;
create policy "Anyone can view profile images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their profile images" on storage.objects;
create policy "Users can upload their profile images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their profile images" on storage.objects;
create policy "Users can update their profile images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their profile images" on storage.objects;
create policy "Users can delete their profile images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter table public.freight_loads
  add column if not exists pre_order_id uuid references public.pre_orders(id) on delete set null,
  add column if not exists supplier_id uuid references auth.users(id) on delete set null,
  add column if not exists buyer_id uuid references auth.users(id) on delete set null,
  add column if not exists supplier_handover_confirmed_at timestamptz,
  add column if not exists driver_pickup_confirmed_at timestamptz,
  add column if not exists driver_delivery_confirmed_at timestamptz,
  add column if not exists buyer_receipt_confirmed_at timestamptz;

update public.freight_loads
set driver_pickup_confirmed_at = coalesce(driver_pickup_confirmed_at, in_transit_at),
    driver_delivery_confirmed_at = coalesce(driver_delivery_confirmed_at, delivered_at)
where status in ('in_transit', 'delivered');

create index if not exists freight_loads_pre_order_idx
  on public.freight_loads (pre_order_id)
  where pre_order_id is not null;

create or replace function public.set_freight_load_order_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_buyer uuid;
  order_supplier uuid;
begin
  if new.pre_order_id is null then
    return new;
  end if;

  select o.buyer_id, p.user_id
  into order_buyer, order_supplier
  from public.pre_orders o
  join public.products p on p.id = o.product_id
  where o.id = new.pre_order_id;

  if order_buyer is null or order_supplier is null then
    raise exception 'The linked order must have a buyer and a product supplier';
  end if;

  new.buyer_id := order_buyer;
  new.supplier_id := order_supplier;
  return new;
end;
$$;

drop trigger if exists set_freight_load_order_participants on public.freight_loads;
create trigger set_freight_load_order_participants
  before insert or update of pre_order_id on public.freight_loads
  for each row
  execute function public.set_freight_load_order_participants();

drop policy if exists "Freight participants can read their loads" on public.freight_loads;
create policy "Freight participants can read their loads"
  on public.freight_loads for select to authenticated
  using (
    status = 'open'
    or driver_id = (select auth.uid())
    or supplier_id = (select auth.uid())
    or buyer_id = (select auth.uid())
    or public.is_agrilink_admin()
  );

grant select on public.freight_loads to authenticated;

create table if not exists public.freight_tracking_locations (
  id bigint generated always as identity primary key,
  freight_load_id uuid not null references public.freight_loads(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  recorded_at timestamptz not null default now()
);

create index if not exists freight_tracking_locations_load_recorded_idx
  on public.freight_tracking_locations (freight_load_id, recorded_at desc);

create table if not exists public.freight_load_events (
  id bigint generated always as identity primary key,
  freight_load_id uuid not null references public.freight_loads(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'accepted',
    'supplier_handover',
    'driver_pickup',
    'driver_delivery',
    'buyer_received'
  )),
  created_at timestamptz not null default now()
);

create index if not exists freight_load_events_load_created_idx
  on public.freight_load_events (freight_load_id, created_at);

insert into public.freight_load_events (freight_load_id, actor_id, event_type, created_at)
select l.id, l.driver_id, 'accepted', coalesce(l.accepted_at, now())
from public.freight_loads l
where l.driver_id is not null
  and l.status in ('accepted', 'in_transit', 'delivered')
  and not exists (
    select 1 from public.freight_load_events e
    where e.freight_load_id = l.id
      and e.event_type = 'accepted'
  );

insert into public.freight_load_events (freight_load_id, actor_id, event_type, created_at)
select l.id, l.driver_id, 'driver_pickup', coalesce(l.in_transit_at, now())
from public.freight_loads l
where l.driver_id is not null
  and l.status in ('in_transit', 'delivered')
  and not exists (
    select 1 from public.freight_load_events e
    where e.freight_load_id = l.id
      and e.event_type = 'driver_pickup'
  );

insert into public.freight_load_events (freight_load_id, actor_id, event_type, created_at)
select l.id, l.driver_id, 'driver_delivery', coalesce(l.delivered_at, now())
from public.freight_loads l
where l.driver_id is not null
  and l.status = 'delivered'
  and not exists (
    select 1 from public.freight_load_events e
    where e.freight_load_id = l.id
      and e.event_type = 'driver_delivery'
  );

create table if not exists public.freight_settlements (
  id uuid primary key default gen_random_uuid(),
  freight_load_id uuid not null unique references public.freight_loads(id) on delete restrict,
  driver_id uuid not null references auth.users(id) on delete restrict,
  currency text not null default 'Kz',
  gross_amount numeric(14, 2) not null check (gross_amount > 0),
  agrilink_commission numeric(14, 2) not null check (agrilink_commission >= 0),
  driver_amount numeric(14, 2) not null check (driver_amount >= 0),
  status text not null default 'awaiting_manual_payout'
    check (status in ('awaiting_manual_payout', 'paid', 'cancelled')),
  confirmed_at timestamptz not null default now(),
  paid_at timestamptz,
  payout_reference text,
  paid_by uuid references auth.users(id) on delete set null
);

create or replace function public.create_freight_settlement_if_ready(p_freight_load_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ready_load record;
begin
  select l.id, l.driver_id, l.currency, l.offered_price
  into ready_load
  from public.freight_loads l
  where l.id = p_freight_load_id
    and l.status = 'delivered'
    and l.supplier_handover_confirmed_at is not null
    and l.driver_pickup_confirmed_at is not null
    and l.driver_delivery_confirmed_at is not null
    and l.buyer_receipt_confirmed_at is not null;

  if found and ready_load.driver_id is not null and ready_load.offered_price > 0 then
    insert into public.freight_settlements (
      freight_load_id,
      driver_id,
      currency,
      gross_amount,
      agrilink_commission,
      driver_amount
    )
    values (
      ready_load.id,
      ready_load.driver_id,
      coalesce(nullif(ready_load.currency, ''), 'Kz'),
      ready_load.offered_price,
      round(ready_load.offered_price * 0.08, 2),
      round(ready_load.offered_price - round(ready_load.offered_price * 0.08, 2), 2)
    )
    on conflict (freight_load_id) do nothing;
  end if;
end;
$$;

alter table public.freight_tracking_locations enable row level security;
alter table public.freight_load_events enable row level security;
alter table public.freight_settlements enable row level security;

drop policy if exists "Freight participants can read tracking locations" on public.freight_tracking_locations;
create policy "Freight participants can read tracking locations"
  on public.freight_tracking_locations for select to authenticated
  using (
    exists (
      select 1
      from public.freight_loads l
      where l.id = freight_load_id
        and (l.driver_id = (select auth.uid())
          or l.supplier_id = (select auth.uid())
          or l.buyer_id = (select auth.uid())
          or public.is_agrilink_admin())
    )
  );

drop policy if exists "Freight participants can read load events" on public.freight_load_events;
create policy "Freight participants can read load events"
  on public.freight_load_events for select to authenticated
  using (
    exists (
      select 1
      from public.freight_loads l
      where l.id = freight_load_id
        and (l.driver_id = (select auth.uid())
          or l.supplier_id = (select auth.uid())
          or l.buyer_id = (select auth.uid())
          or public.is_agrilink_admin())
    )
  );

drop policy if exists "Freight participants can read settlements" on public.freight_settlements;
create policy "Freight participants can read settlements"
  on public.freight_settlements for select to authenticated
  using (
    exists (
      select 1
      from public.freight_loads l
      where l.id = freight_load_id
        and (l.driver_id = (select auth.uid())
          or l.supplier_id = (select auth.uid())
          or l.buyer_id = (select auth.uid())
          or public.is_agrilink_admin())
    )
  );

drop policy if exists "AgriLink admins can update freight settlements" on public.freight_settlements;
create policy "AgriLink admins can update freight settlements"
  on public.freight_settlements for update to authenticated
  using (public.is_agrilink_admin())
  with check (public.is_agrilink_admin());

grant select on public.freight_tracking_locations, public.freight_load_events, public.freight_settlements to authenticated;
revoke insert, update, delete on public.freight_tracking_locations from anon, authenticated;
revoke insert, update, delete on public.freight_load_events from anon, authenticated;
revoke insert, delete on public.freight_settlements from anon, authenticated;
grant update (status, paid_at, payout_reference, paid_by) on public.freight_settlements to authenticated;

drop function if exists public.accept_freight_load(uuid);

create function public.accept_freight_load(
  p_freight_load_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  accepted_id uuid;
  registered_capacity numeric;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not (
    exists (
      select 1
      from public.users u
      where (u.id = actor_id or to_jsonb(u) ->> 'user_id' = actor_id::text)
        and lower(coalesce(
          to_jsonb(u) ->> 'user_type',
          to_jsonb(u) ->> 'role',
          to_jsonb(u) ->> 'user_role',
          to_jsonb(u) ->> 'type',
          to_jsonb(u) ->> 'account_type',
          ''
        )) in ('motorista', 'driver', 'transportador', 'transportadora')
    )
    or exists (
      select 1
      from public.profiles p
      where (p.id = actor_id or to_jsonb(p) ->> 'user_id' = actor_id::text)
        and lower(coalesce(
          to_jsonb(p) ->> 'user_type',
          to_jsonb(p) ->> 'role',
          to_jsonb(p) ->> 'user_role',
          to_jsonb(p) ->> 'type',
          to_jsonb(p) ->> 'account_type',
          ''
        )) in ('motorista', 'driver', 'transportador', 'transportadora')
    )
    or lower(coalesce(
      auth.jwt() #>> '{user_metadata,user_type}',
      auth.jwt() #>> '{user_metadata,role}',
      auth.jwt() #>> '{user_metadata,user_role}',
      auth.jwt() #>> '{user_metadata,type}',
      auth.jwt() #>> '{user_metadata,account_type}',
      ''
    )) in ('motorista', 'driver', 'transportador', 'transportadora')
  ) then
    raise exception 'Only a registered driver can accept freight loads';
  end if;
  select nullif(to_jsonb(p) ->> 'load_capacity_kg', '')::numeric
  into registered_capacity
  from public.profiles p
  where p.id = actor_id
     or to_jsonb(p) ->> 'user_id' = actor_id::text
  limit 1;

  if registered_capacity is null then
    select nullif(to_jsonb(u) ->> 'load_capacity_kg', '')::numeric
    into registered_capacity
    from public.users u
    where u.id = actor_id
       or to_jsonb(u) ->> 'user_id' = actor_id::text
    limit 1;
  end if;

  if registered_capacity is null then
    registered_capacity := nullif(auth.jwt() #>> '{user_metadata,load_capacity_kg}', '')::numeric;
  end if;

  if registered_capacity is null or registered_capacity <= 0 then
    raise exception 'A valid vehicle capacity is required';
  end if;

  update public.freight_loads
  set driver_id = actor_id,
      status = 'accepted',
      accepted_at = now()
  where id = p_freight_load_id
    and status = 'open'
    and driver_id is null
    and weight_kg <= registered_capacity
  returning id into accepted_id;

  if accepted_id is null then
    raise exception 'Freight load is no longer available or exceeds vehicle capacity';
  end if;

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  values (accepted_id, actor_id, 'accepted');

  return accepted_id;
end;
$$;

create or replace function public.advance_freight_load(p_freight_load_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_status text;
  next_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select l.status into current_status
  from public.freight_loads l
  where l.id = p_freight_load_id
    and l.driver_id = actor_id
  for update;

  if current_status = 'accepted' then
    next_status := 'in_transit';
    update public.freight_loads
    set status = next_status,
        in_transit_at = now(),
        driver_pickup_confirmed_at = now()
    where id = p_freight_load_id;
    insert into public.freight_load_events (freight_load_id, actor_id, event_type)
    values (p_freight_load_id, actor_id, 'driver_pickup');
  elsif current_status = 'in_transit' then
    next_status := 'delivered';
    update public.freight_loads
    set status = next_status,
        delivered_at = now(),
        driver_delivery_confirmed_at = now()
    where id = p_freight_load_id;
    insert into public.freight_load_events (freight_load_id, actor_id, event_type)
    values (p_freight_load_id, actor_id, 'driver_delivery');
  else
    raise exception 'Freight load is not ready for this transition';
  end if;

  return next_status;
end;
$$;

create or replace function public.confirm_freight_handover(p_freight_load_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  update public.freight_loads
  set supplier_handover_confirmed_at = coalesce(supplier_handover_confirmed_at, now())
  where id = p_freight_load_id
    and supplier_id = actor_id
    and status in ('accepted', 'in_transit', 'delivered');

  if not found then
    raise exception 'Only the load supplier can confirm handover';
  end if;

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  select p_freight_load_id, actor_id, 'supplier_handover'
  where not exists (
    select 1 from public.freight_load_events e
    where e.freight_load_id = p_freight_load_id
      and e.event_type = 'supplier_handover'
  );

  perform public.create_freight_settlement_if_ready(p_freight_load_id);
end;
$$;

create or replace function public.confirm_freight_receipt(p_freight_load_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  update public.freight_loads
  set buyer_receipt_confirmed_at = coalesce(buyer_receipt_confirmed_at, now())
  where id = p_freight_load_id
    and buyer_id = actor_id
    and status = 'delivered';

  if not found then
    raise exception 'Only the buyer can confirm receipt of a delivered load';
  end if;

  insert into public.freight_load_events (freight_load_id, actor_id, event_type)
  select p_freight_load_id, actor_id, 'buyer_received'
  where not exists (
    select 1 from public.freight_load_events e
    where e.freight_load_id = p_freight_load_id
      and e.event_type = 'buyer_received'
  );

  perform public.create_freight_settlement_if_ready(p_freight_load_id);
end;
$$;

create or replace function public.update_freight_tracking_location(
  p_freight_load_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  location_time timestamptz := now();
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  insert into public.freight_tracking_locations (
    freight_load_id, driver_id, latitude, longitude, recorded_at
  )
  select l.id, actor_id, p_latitude, p_longitude, location_time
  from public.freight_loads l
  where l.id = p_freight_load_id
    and l.driver_id = actor_id
    and l.status = 'in_transit'
  returning recorded_at into location_time;

  if not found then
    raise exception 'Only the assigned driver can share a location while in transit';
  end if;

  delete from public.freight_tracking_locations t
  where t.id in (
    select old_point.id
    from public.freight_tracking_locations old_point
    where old_point.freight_load_id = p_freight_load_id
    order by old_point.recorded_at desc
    offset 1500
  );

  return location_time;
end;
$$;

revoke all on function public.accept_freight_load(uuid) from public;
revoke all on function public.advance_freight_load(uuid) from public;
revoke all on function public.confirm_freight_handover(uuid) from public;
revoke all on function public.confirm_freight_receipt(uuid) from public;
revoke all on function public.update_freight_tracking_location(uuid, double precision, double precision) from public;
revoke all on function public.create_freight_settlement_if_ready(uuid) from public;
grant execute on function public.accept_freight_load(uuid) to authenticated;
grant execute on function public.advance_freight_load(uuid) to authenticated;
grant execute on function public.confirm_freight_handover(uuid) to authenticated;
grant execute on function public.confirm_freight_receipt(uuid) to authenticated;
grant execute on function public.update_freight_tracking_location(uuid, double precision, double precision) to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'freight_tracking_locations'
    ) then
      alter publication supabase_realtime add table public.freight_tracking_locations;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'freight_load_events'
    ) then
      alter publication supabase_realtime add table public.freight_load_events;
    end if;
  end if;
end;
$$;
