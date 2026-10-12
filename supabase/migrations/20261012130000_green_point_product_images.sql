alter table public.green_point_products
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'green-point-products',
  'green-point-products',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Anyone can view Green Point product images" on storage.objects;
create policy "Anyone can view Green Point product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'green-point-products');

drop policy if exists "Admins can upload Green Point product images" on storage.objects;
create policy "Admins can upload Green Point product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'green-point-products'
    and public.is_agrilink_admin()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins can delete Green Point product images" on storage.objects;
create policy "Admins can delete Green Point product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'green-point-products'
    and public.is_agrilink_admin()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
