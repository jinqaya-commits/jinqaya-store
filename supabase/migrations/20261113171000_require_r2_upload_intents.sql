create or replace function public.admin_create_product_image_upload_intent(
  p_product_id uuid,
  p_storage_path text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_key text;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;
  if p_storage_path is null or left(p_storage_path, 5) <> 'r2://' then
    raise exception 'Only R2 product image uploads can be registered';
  end if;
  v_key := substring(p_storage_path from 6);
  if v_key = ''
     or split_part(v_key, '/', 1) <> p_product_id::text
     or position('/' in v_key) = 0
     or v_key like '%..%' then
    raise exception 'Invalid product image storage path';
  end if;
  perform 1 from public.products where id = p_product_id;
  if not found then raise exception 'Product not found'; end if;
  insert into public.product_image_upload_intents(product_id, storage_path, expires_at, created_by)
  values (p_product_id, p_storage_path, now() + interval '20 minutes', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_create_product_image_upload_intent(uuid,text) from public, anon;
grant execute on function public.admin_create_product_image_upload_intent(uuid,text) to authenticated;
