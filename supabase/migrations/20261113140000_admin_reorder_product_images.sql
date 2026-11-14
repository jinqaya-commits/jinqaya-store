create or replace function public.admin_reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
  v_distinct_count integer;
  v_actual_count integer;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;

  if p_product_id is null or p_image_ids is null then
    raise exception 'Product and image order are required';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;

  select count(*), count(distinct image_id)
    into v_count, v_distinct_count
  from unnest(p_image_ids) as supplied(image_id);

  if v_count <> v_distinct_count then
    raise exception 'Image order contains duplicate IDs';
  end if;

  select count(*) into v_actual_count
  from public.product_images
  where product_id = p_product_id;

  if v_count <> v_actual_count or exists (
    select 1
    from unnest(p_image_ids) as supplied(image_id)
    left join public.product_images pi
      on pi.id = supplied.image_id and pi.product_id = p_product_id
    where pi.id is null
  ) then
    raise exception 'Image order must include every image for this product exactly once';
  end if;

  update public.product_images pi
  set sort_order = ordered.ordinality - 1,
      is_primary = ordered.ordinality = 1,
      image_type = (case when ordered.ordinality = 1 then 'main' else 'gallery' end)::public.image_kind
  from unnest(p_image_ids) with ordinality as ordered(image_id, ordinality)
  where pi.id = ordered.image_id
    and pi.product_id = p_product_id;
end;
$function$;

revoke all on function public.admin_reorder_product_images(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reorder_product_images(uuid, uuid[]) to authenticated;
