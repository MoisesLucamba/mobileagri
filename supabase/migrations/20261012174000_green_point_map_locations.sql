alter table public.green_points
  drop constraint if exists green_points_location_pair_check;

alter table public.green_points
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

alter table public.green_points
  add constraint green_points_location_pair_check
  check (
    (location_lat is null and location_lng is null)
    or (
      location_lat is not null
      and location_lng is not null
      and
      location_lat between -90 and 90
      and location_lng between -180 and 180
    )
  );
