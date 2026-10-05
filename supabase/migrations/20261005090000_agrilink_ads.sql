create or replace function public.is_agrilink_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() #>> '{app_metadata,role}' = 'admin', false)
    or coalesce(auth.jwt() #>> '{app_metadata,is_admin}' = 'true', false);
$$;

grant execute on function public.is_agrilink_admin() to anon, authenticated;

create table if not exists public.agrilink_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 10 and 3000),
  target_url text not null check (target_url ~* '^https?://'),
  image_urls text[] not null check (cardinality(image_urls) >= 3),
  status text not null default 'active' check (status in ('draft', 'active', 'paused')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rating_sum integer not null default 0 check (rating_sum >= 0),
  rating_count integer not null default 0 check (rating_count >= 0),
  rating_average numeric(3, 2) not null default 0 check (rating_average between 0 and 5)
);

create index if not exists agrilink_ads_active_created_idx
  on public.agrilink_ads (created_at desc)
  where status = 'active';

create table if not exists public.agrilink_ad_ratings (
  ad_id uuid not null references public.agrilink_ads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ad_id, user_id)
);

alter table public.agrilink_ads enable row level security;
alter table public.agrilink_ad_ratings enable row level security;

drop policy if exists "Anyone can read active Agrilink ads" on public.agrilink_ads;
create policy "Anyone can read active Agrilink ads"
  on public.agrilink_ads for select to anon, authenticated
  using (status = 'active' or public.is_agrilink_admin());

drop policy if exists "Admins can create Agrilink ads" on public.agrilink_ads;
create policy "Admins can create Agrilink ads"
  on public.agrilink_ads for insert to authenticated
  with check (public.is_agrilink_admin() and created_by = (select auth.uid()));

drop policy if exists "Admins can update Agrilink ads" on public.agrilink_ads;
create policy "Admins can update Agrilink ads"
  on public.agrilink_ads for update to authenticated
  using (public.is_agrilink_admin())
  with check (public.is_agrilink_admin());

drop policy if exists "Admins can delete Agrilink ads" on public.agrilink_ads;
create policy "Admins can delete Agrilink ads"
  on public.agrilink_ads for delete to authenticated
  using (public.is_agrilink_admin());

drop policy if exists "Users can read their own Agrilink ad ratings" on public.agrilink_ad_ratings;
create policy "Users can read their own Agrilink ad ratings"
  on public.agrilink_ad_ratings for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.agrilink_ads to anon, authenticated;
grant insert, update, delete on public.agrilink_ads to authenticated;
grant select on public.agrilink_ad_ratings to authenticated;
revoke insert, update, delete on public.agrilink_ad_ratings from anon, authenticated;

create or replace function public.rate_agrilink_ad(p_ad_id uuid, p_rating smallint)
returns table (rating_average numeric, rating_count integer)
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

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  if not exists (
    select 1 from public.agrilink_ads a
    where a.id = p_ad_id and a.status = 'active'
  ) then
    raise exception 'Ad is not available';
  end if;

  insert into public.agrilink_ad_ratings (ad_id, user_id, rating)
  values (p_ad_id, actor_id, p_rating)
  on conflict (ad_id, user_id) do update
    set rating = excluded.rating, updated_at = now();

  update public.agrilink_ads a
  set rating_sum = totals.rating_sum,
      rating_count = totals.rating_count,
      rating_average = case
        when totals.rating_count = 0 then 0
        else round(totals.rating_sum::numeric / totals.rating_count, 2)
      end,
      updated_at = now()
  from (
    select r.ad_id, sum(r.rating)::integer as rating_sum, count(*)::integer as rating_count
    from public.agrilink_ad_ratings r
    where r.ad_id = p_ad_id
    group by r.ad_id
  ) totals
  where a.id = totals.ad_id;

  return query
  select a.rating_average, a.rating_count
  from public.agrilink_ads a
  where a.id = p_ad_id;
end;
$$;

grant execute on function public.rate_agrilink_ad(uuid, smallint) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agrilink-ads',
  'agrilink-ads',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Anyone can view Agrilink ad images" on storage.objects;
create policy "Anyone can view Agrilink ad images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'agrilink-ads');

drop policy if exists "Admins can upload Agrilink ad images" on storage.objects;
create policy "Admins can upload Agrilink ad images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agrilink-ads'
    and public.is_agrilink_admin()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins can delete Agrilink ad images" on storage.objects;
create policy "Admins can delete Agrilink ad images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agrilink-ads'
    and public.is_agrilink_admin()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );