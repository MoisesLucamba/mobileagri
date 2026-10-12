alter table public.products
  add column if not exists is_processed boolean not null default false,
  add column if not exists unit text not null default 'kg';

alter table public.products
  alter column harvest_date drop not null;
