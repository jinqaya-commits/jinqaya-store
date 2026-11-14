-- Track every signed R2 upload before issuing its short-lived URL.
create table public.product_image_upload_intents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending','claimed')),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index product_image_upload_intents_due_idx
  on public.product_image_upload_intents(status, expires_at, next_attempt_at, locked_at);
alter table public.product_image_upload_intents enable row level security;
revoke all on table public.product_image_upload_intents from public, anon, authenticated;

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
  v_key := case when left(coalesce(p_storage_path, ''), 5) = 'r2://'
    then substring(p_storage_path from 6) else p_storage_path end;
  if p_storage_path is null or p_storage_path = ''
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

create or replace function public.admin_add_product_image(
  p_product_id uuid,
  p_storage_path text,
  p_alt_text text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_image_id uuid;
  v_object_key text;
  v_intent_id uuid;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;
  if p_storage_path is null or p_storage_path = '' then
    raise exception 'Invalid image storage path';
  end if;
  v_object_key := case when left(p_storage_path, 5) = 'r2://'
    then substring(p_storage_path from 6) else p_storage_path end;
  if v_object_key = ''
     or split_part(v_object_key, '/', 1) <> p_product_id::text
     or position('/' in v_object_key) = 0
     or v_object_key like '%..%' then
    raise exception 'Invalid image storage path';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;

  select id into v_intent_id
  from public.product_image_upload_intents
  where product_id = p_product_id
    and storage_path = p_storage_path
    and status = 'pending'
    and expires_at > now()
  for update;
  if not found then raise exception 'Upload intent is missing, expired, or already claimed'; end if;

  select count(*) into v_count from public.product_images where product_id = p_product_id;
  insert into public.product_images (
    product_id, storage_path, alt_text, image_type, sort_order, is_primary
  ) values (
    p_product_id, p_storage_path, nullif(btrim(p_alt_text), ''),
    (case when v_count = 0 then 'main' else 'gallery' end)::public.image_kind,
    v_count, v_count = 0
  ) returning id into v_image_id;

  delete from public.product_image_upload_intents where id = v_intent_id;
  return v_image_id;
end;
$$;
revoke all on function public.admin_add_product_image(uuid,text,text) from public, anon;
grant execute on function public.admin_add_product_image(uuid,text,text) to authenticated;

create or replace function public.admin_replace_product_image(
  p_product_id uuid,
  p_image_id uuid,
  p_storage_path text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_path text;
  v_object_key text;
  v_intent_id uuid;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product images';
  end if;
  v_object_key := case when left(coalesce(p_storage_path, ''), 5) = 'r2://'
    then substring(p_storage_path from 6) else p_storage_path end;
  if p_storage_path is null or p_storage_path = ''
     or p_storage_path like 'http://%' or p_storage_path like 'https://%'
     or p_storage_path like '%..%'
     or split_part(v_object_key, '/', 1) <> p_product_id::text
     or position('/' in v_object_key) = 0 then
    raise exception 'Invalid product image storage path';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;

  select id into v_intent_id
  from public.product_image_upload_intents
  where product_id = p_product_id
    and storage_path = p_storage_path
    and status = 'pending'
    and expires_at > now()
  for update;
  if not found then raise exception 'Upload intent is missing, expired, or already claimed'; end if;

  select storage_path into v_old_path
  from public.product_images
  where id = p_image_id and product_id = p_product_id
  for update;
  if not found then raise exception 'Product image not found'; end if;

  if v_old_path is not null and v_old_path <> ''
     and v_old_path not like 'http://%' and v_old_path not like 'https://%' then
    perform pg_advisory_xact_lock(hashtextextended(v_old_path, 0));
  end if;

  update public.product_images set storage_path = p_storage_path
  where id = p_image_id and product_id = p_product_id;

  if v_old_path is not null and v_old_path <> p_storage_path
     and v_old_path <> '' and v_old_path not like 'http://%' and v_old_path not like 'https://%'
     and not exists (select 1 from public.product_images where storage_path = v_old_path) then
    insert into public.product_image_cleanup_queue(storage_path)
    values (v_old_path) on conflict (storage_path) do nothing;
  end if;

  delete from public.product_image_upload_intents where id = v_intent_id;
  return v_old_path;
end;
$$;
revoke all on function public.admin_replace_product_image(uuid,uuid,text) from public, anon;
grant execute on function public.admin_replace_product_image(uuid,uuid,text) to authenticated;

create or replace function public.claim_product_image_upload_cleanup(p_limit integer default 50)
returns table(id uuid, storage_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  with candidates as (
    select i.id
    from public.product_image_upload_intents i
    where i.expires_at <= now()
      and i.next_attempt_at <= now()
      and (i.status = 'pending' or i.locked_at < now() - interval '15 minutes')
    order by i.expires_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.product_image_upload_intents i
  set status = 'claimed', locked_at = now(), attempts = i.attempts + 1
  from candidates c where i.id = c.id
  returning i.id, i.storage_path;
end;
$$;
create or replace function public.complete_product_image_upload_cleanup(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  delete from public.product_image_upload_intents
  where id = p_id and status = 'claimed';
end;
$$;
create or replace function public.fail_product_image_upload_cleanup(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  update public.product_image_upload_intents
  set status = 'pending', locked_at = null,
      next_attempt_at = now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 7))::integer)),
      last_error = left(coalesce(p_error, 'Unknown cleanup error'), 1000)
  where id = p_id;
end;
$$;
revoke all on function public.claim_product_image_upload_cleanup(integer) from public, anon, authenticated;
revoke all on function public.complete_product_image_upload_cleanup(uuid) from public, anon, authenticated;
revoke all on function public.fail_product_image_upload_cleanup(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_product_image_upload_cleanup(integer) to service_role;
grant execute on function public.complete_product_image_upload_cleanup(uuid) to service_role;
grant execute on function public.fail_product_image_upload_cleanup(uuid,text) to service_role;
