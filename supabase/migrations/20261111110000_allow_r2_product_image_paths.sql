-- Normalize the R2 scheme for validation while preserving the stored URI.
-- The image_kind cast is required because image_type is a PostgreSQL enum.
create or replace function public.admin_add_product_image(
  p_product_id uuid,
  p_storage_path text,
  p_alt_text text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_count integer;
  v_image_id uuid;
  v_object_key text;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;

  if p_storage_path is null or p_storage_path = '' then
    raise exception 'Invalid image storage path';
  end if;

  v_object_key := case
    when left(p_storage_path, 5) = 'r2://' then substring(p_storage_path from 6)
    else p_storage_path
  end;

  if v_object_key = ''
     or v_object_key not like p_product_id::text || '/%'
     or v_object_key like '%..%' then
    raise exception 'Invalid image storage path';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;

  select count(*) into v_count
  from public.product_images
  where product_id = p_product_id;

  insert into public.product_images (
    product_id, storage_path, alt_text, image_type, sort_order, is_primary
  ) values (
    p_product_id,
    p_storage_path,
    nullif(btrim(p_alt_text), ''),
    (case when v_count = 0 then 'main' else 'gallery' end)::public.image_kind,
    v_count,
    v_count = 0
  )
  returning id into v_image_id;

  return v_image_id;
end;
$function$;
