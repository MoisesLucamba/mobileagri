create table if not exists public.green_points (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  province text not null,
  municipality text not null,
  address text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.green_point_products (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.green_points(id) on delete cascade,
  product_name text not null check (char_length(trim(product_name)) between 2 and 120),
  description text,
  unit text not null default 'kg',
  price numeric(12, 2) not null check (price > 0),
  market_price numeric(12, 2) not null check (market_price > price),
  stock_quantity numeric(12, 2) not null default 0 check (stock_quantity >= 0),
  is_available boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists green_point_products_available_idx
  on public.green_point_products (point_id, product_name)
  where is_available and stock_quantity > 0;

create table if not exists public.green_point_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  point_id uuid not null references public.green_points(id) on delete restrict,
  pickup_date date not null,
  payment_method text not null default 'pay_at_pickup'
    check (payment_method = 'pay_at_pickup'),
  status text not null default 'reserved'
    check (status in ('reserved', 'confirmed', 'ready', 'picked_up', 'cancelled')),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists green_point_orders_buyer_created_idx
  on public.green_point_orders (buyer_id, created_at desc);
create index if not exists green_point_orders_point_pickup_idx
  on public.green_point_orders (point_id, pickup_date, status);

create table if not exists public.green_point_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.green_point_orders(id) on delete cascade,
  product_id uuid not null references public.green_point_products(id) on delete restrict,
  product_name text not null,
  unit text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  subtotal numeric(12, 2) not null check (subtotal > 0),
  created_at timestamptz not null default now()
);

alter table public.green_points enable row level security;
alter table public.green_point_products enable row level security;
alter table public.green_point_orders enable row level security;
alter table public.green_point_order_items enable row level security;

drop policy if exists "Anyone can read active green points" on public.green_points;
create policy "Anyone can read active green points"
  on public.green_points for select to anon, authenticated
  using (is_active or public.is_agrilink_admin());

drop policy if exists "Admins manage green points" on public.green_points;
create policy "Admins manage green points"
  on public.green_points for all to authenticated
  using (public.is_agrilink_admin())
  with check (public.is_agrilink_admin());

drop policy if exists "Anyone can read available green point products" on public.green_point_products;
create policy "Anyone can read available green point products"
  on public.green_point_products for select to anon, authenticated
  using (
    is_available
    and exists (
      select 1 from public.green_points gp
      where gp.id = point_id and gp.is_active
    )
    or public.is_agrilink_admin()
  );

drop policy if exists "Admins manage green point products" on public.green_point_products;
create policy "Admins manage green point products"
  on public.green_point_products for all to authenticated
  using (public.is_agrilink_admin())
  with check (public.is_agrilink_admin());

drop policy if exists "Buyers and admins read green point orders" on public.green_point_orders;
create policy "Buyers and admins read green point orders"
  on public.green_point_orders for select to authenticated
  using (buyer_id = (select auth.uid()) or public.is_agrilink_admin());

drop policy if exists "Buyers and admins read green point order items" on public.green_point_order_items;
create policy "Buyers and admins read green point order items"
  on public.green_point_order_items for select to authenticated
  using (
    exists (
      select 1 from public.green_point_orders o
      where o.id = order_id
        and (o.buyer_id = (select auth.uid()) or public.is_agrilink_admin())
    )
  );

grant select on public.green_points, public.green_point_products to anon, authenticated;
grant insert, update, delete on public.green_points, public.green_point_products to authenticated;
grant select on public.green_point_orders, public.green_point_order_items to authenticated;
revoke insert, delete on public.green_point_orders from anon, authenticated;
revoke insert, update, delete on public.green_point_order_items from anon, authenticated;

create or replace function public.create_green_point_order(
  p_point_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_pickup_date date
)
returns public.green_point_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_product public.green_point_products%rowtype;
  created_order public.green_point_orders%rowtype;
  angola_today date := (now() at time zone 'Africa/Luanda')::date;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_pickup_date is null or p_pickup_date not in (angola_today, angola_today + 1) then
    raise exception 'Pickup must be today or tomorrow';
  end if;
  if not exists (
    select 1 from public.green_points gp
    where gp.id = p_point_id and gp.is_active
  ) then
    raise exception 'Green point is not available';
  end if;

  select * into selected_product
  from public.green_point_products gpp
  where gpp.id = p_product_id
    and gpp.point_id = p_point_id
    and gpp.is_available
  for update;

  if not found then
    raise exception 'Product is not available at this green point';
  end if;
  if selected_product.stock_quantity < p_quantity then
    raise exception 'Insufficient stock';
  end if;

  insert into public.green_point_orders (
    buyer_id, point_id, pickup_date, total_amount
  )
  values (
    actor_id, p_point_id, p_pickup_date, selected_product.price * p_quantity
  )
  returning * into created_order;

  insert into public.green_point_order_items (
    order_id, product_id, product_name, unit, quantity, unit_price, subtotal
  )
  values (
    created_order.id, selected_product.id, selected_product.product_name,
    selected_product.unit, p_quantity, selected_product.price,
    selected_product.price * p_quantity
  );

  update public.green_point_products
  set stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  where id = selected_product.id;

  return created_order;
end;
$$;

revoke all on function public.create_green_point_order(uuid, uuid, numeric, date) from public;
grant execute on function public.create_green_point_order(uuid, uuid, numeric, date) to authenticated;

create or replace function public.update_green_point_order_status(
  p_order_id uuid,
  p_status text
)
returns public.green_point_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.green_point_orders%rowtype;
  updated_order public.green_point_orders%rowtype;
  allowed_next_statuses text[];
begin
  if auth.uid() is null or not public.is_agrilink_admin() then
    raise exception 'Only AgriLink administrators can update pickup orders';
  end if;

  select * into target_order
  from public.green_point_orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception 'Pickup order not found';
  end if;

  allowed_next_statuses := case target_order.status
    when 'reserved' then array['confirmed', 'cancelled']
    when 'confirmed' then array['ready', 'cancelled']
    when 'ready' then array['picked_up', 'cancelled']
    else array[]::text[]
  end;
  if p_status is null or not (p_status = any(allowed_next_statuses)) then
    raise exception 'Invalid pickup order status transition';
  end if;

  if p_status = 'cancelled' then
    update public.green_point_products gpp
    set stock_quantity = gpp.stock_quantity + items.quantity,
        updated_at = now()
    from (
      select oi.product_id, sum(oi.quantity) as quantity
      from public.green_point_order_items oi
      where oi.order_id = target_order.id
      group by oi.product_id
    ) items
    where gpp.id = items.product_id;
  end if;

  update public.green_point_orders
  set status = p_status, updated_at = now()
  where id = target_order.id
  returning * into updated_order;
  return updated_order;
end;
$$;

revoke all on function public.update_green_point_order_status(uuid, text) from public;
grant execute on function public.update_green_point_order_status(uuid, text) to authenticated;

do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists "AgriLink admins can read dashboard notifications" on public.notifications';
    execute 'create policy "AgriLink admins can read dashboard notifications" on public.notifications for select to authenticated using (public.is_agrilink_admin())';
    execute 'grant select on public.notifications to authenticated';
  end if;
end;
$$;
