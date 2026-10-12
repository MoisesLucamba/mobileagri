alter table public.agrilink_ads
  add column if not exists advertiser_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agrilink_ads_advertiser_name_length'
      and conrelid = 'public.agrilink_ads'::regclass
  ) then
    alter table public.agrilink_ads
      add constraint agrilink_ads_advertiser_name_length
      check (
        advertiser_name is null
        or char_length(trim(advertiser_name)) between 2 and 100
      );
  end if;
end;
$$;
