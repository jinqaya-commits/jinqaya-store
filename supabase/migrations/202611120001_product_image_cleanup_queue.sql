-- Durable cleanup queue for deleted product image objects.
create table if not exists public.product_image_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.product_image_cleanup_queue enable row level security;
revoke all on public.product_image_cleanup_queue from anon, authenticated;
revoke all on public.product_image_cleanup_queue from public;

create or replace function public.admin_delete_product_image(p_product_id uuid, p_image_id uuid)
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
     and v_storage_path not like 'https://%' then
    insert into public.product_image_cleanup_queue(storage_path)
    values (v_storage_path)
    on conflict (storage_path) do nothing;
  end if;

  return v_storage_path;
end;
$function$;

create or replace function public.claim_product_image_cleanup(p_limit integer default 50)
returns table(id uuid, storage_path text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select q.id
    from public.product_image_cleanup_queue q
    where q.next_attempt_at <= now()
      and (q.locked_at is null or q.locked_at < now() - interval '15 minutes')
    order by q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.product_image_cleanup_queue q
  set locked_at = now(), attempts = q.attempts + 1
  from candidates c
  where q.id = c.id
  returning q.id, q.storage_path;
end;
$function$;

create or replace function public.complete_product_image_cleanup(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  delete from public.product_image_cleanup_queue where id = p_id;
end;
$function$;

create or replace function public.fail_product_image_cleanup(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  update public.product_image_cleanup_queue
  set locked_at = null,
      next_attempt_at = now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 7))::integer)),
      last_error = left(coalesce(p_error, 'Unknown cleanup error'), 1000)
  where id = p_id;
end;
$function$;

revoke all on function public.claim_product_image_cleanup(integer) from public, anon, authenticated;
revoke all on function public.complete_product_image_cleanup(uuid) from public, anon, authenticated;
revoke all on function public.fail_product_image_cleanup(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_product_image_cleanup(integer) to service_role;
grant execute on function public.complete_product_image_cleanup(uuid) to service_role;
grant execute on function public.fail_product_image_cleanup(uuid, text) to service_role;
