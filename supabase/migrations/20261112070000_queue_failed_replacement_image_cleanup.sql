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

  -- Serialize enqueue with image-row insert/update for this exact storage path.
  perform pg_advisory_xact_lock(hashtextextended(p_storage_path, 0));

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


-- A queued storage path must not be reattached while the cleanup worker may
-- be deleting it. The queue row remains present until the worker completes.
create or replace function public.prevent_product_image_reuse_while_cleanup_pending()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.storage_path is not null then
    -- Use the same transaction lock as the enqueue RPC to close the race
    -- between checking references and creating the cleanup queue row.
    perform pg_advisory_xact_lock(hashtextextended(new.storage_path, 0));

    if exists (
      select 1
      from public.product_image_cleanup_queue q
      where q.storage_path = new.storage_path
    ) then
      raise exception 'This image file is pending cleanup and cannot be reused. Upload it again.';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.prevent_product_image_reuse_while_cleanup_pending() from public, anon, authenticated;

drop trigger if exists product_images_prevent_pending_cleanup_reuse on public.product_images;
create trigger product_images_prevent_pending_cleanup_reuse
before insert or update of storage_path on public.product_images
for each row execute function public.prevent_product_image_reuse_while_cleanup_pending();


-- Serialize row deletion + queue insertion with image-row reuse for the same path.
create or replace function public.admin_delete_product_image(
  p_product_id uuid,
  p_image_id uuid
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_storage_path text;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;

  select storage_path into v_storage_path
  from public.product_images
  where id = p_image_id and product_id = p_product_id
  for update;

  if not found then raise exception 'Image not found'; end if;

  if v_storage_path is not null and v_storage_path <> '' then
    perform pg_advisory_xact_lock(hashtextextended(v_storage_path, 0));
  end if;

  delete from public.product_images
  where id = p_image_id and product_id = p_product_id;

  with ranked as (
    select id, row_number() over (order by sort_order asc, id asc) - 1 as new_order
    from public.product_images where product_id = p_product_id
  )
  update public.product_images pi
  set sort_order = ranked.new_order,
      is_primary = ranked.new_order = 0,
      image_type = (case when ranked.new_order = 0 then 'main' else 'gallery' end)::public.image_kind
  from ranked where pi.id = ranked.id;

  if v_storage_path is not null
     and v_storage_path <> ''
     and v_storage_path not like 'http://%'
     and v_storage_path not like 'https://%'
     and not exists (
       select 1 from public.product_images where storage_path = v_storage_path
     ) then
    insert into public.product_image_cleanup_queue(storage_path)
    values (v_storage_path)
    on conflict (storage_path) do nothing;
  end if;

  return v_storage_path;
end;
$function$;
