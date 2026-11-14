-- Atomically replace a product image and queue its detached previous object.
create or replace function public.admin_replace_product_image(
  p_product_id uuid,
  p_image_id uuid,
  p_storage_path text
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old_path text;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;

  if p_storage_path is null
     or p_storage_path = ''
     or p_storage_path like 'http://%'
     or p_storage_path like 'https://%'
     or p_storage_path like '%..%'
     or (split_part(p_storage_path, '/', 1) <> p_product_id::text
       and left(p_storage_path, 5) <> 'r2://') then
    raise exception 'Invalid product image storage path';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;

  select storage_path into v_old_path
  from public.product_images
  where id = p_image_id and product_id = p_product_id
  for update;
  if not found then raise exception 'Product image not found'; end if;

  if v_old_path is not null and v_old_path <> ''
     and v_old_path not like 'http://%' and v_old_path not like 'https://%' then
    perform pg_advisory_xact_lock(hashtextextended(v_old_path, 0));
  end if;

  update public.product_images
  set storage_path = p_storage_path
  where id = p_image_id and product_id = p_product_id;

  if v_old_path is not null
     and v_old_path <> p_storage_path
     and v_old_path <> ''
     and v_old_path not like 'http://%'
     and v_old_path not like 'https://%'
     and not exists (
       select 1 from public.product_images where storage_path = v_old_path
     ) then
    insert into public.product_image_cleanup_queue(storage_path)
    values (v_old_path)
    on conflict (storage_path) do nothing;
  end if;

  return v_old_path;
end;
$function$;

revoke all on function public.admin_replace_product_image(uuid, uuid, text) from public, anon;
grant execute on function public.admin_replace_product_image(uuid, uuid, text) to authenticated;
