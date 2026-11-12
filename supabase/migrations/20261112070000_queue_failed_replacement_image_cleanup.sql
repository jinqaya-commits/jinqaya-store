-- Keep failed old-image deletions durable after a successful image replacement.
create or replace function public.admin_enqueue_product_image_cleanup(p_storage_path text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;

  if p_storage_path is null
     or p_storage_path = ''
     or p_storage_path like 'http://%'
     or p_storage_path like 'https://%'
     or p_storage_path like '%..%' then
    raise exception 'Invalid product image storage path';
  end if;

  if exists (
    select 1
    from public.product_images
    where storage_path = p_storage_path
  ) then
    raise exception 'Product image storage path is still in use';
  end if;

  insert into public.product_image_cleanup_queue(storage_path)
  values (p_storage_path)
  on conflict (storage_path) do nothing;
end;
$function$;

revoke all on function public.admin_enqueue_product_image_cleanup(text) from public, anon;
grant execute on function public.admin_enqueue_product_image_cleanup(text) to authenticated;
