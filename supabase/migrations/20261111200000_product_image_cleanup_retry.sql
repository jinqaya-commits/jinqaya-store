-- Persist failed product-image object deletions so R2 and legacy Storage cleanup can retry.
create table if not exists public.product_image_cleanup_queue (
  storage_path text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_image_cleanup_queue enable row level security;
revoke all on table public.product_image_cleanup_queue from public, anon, authenticated;

create or replace function public.enqueue_product_image_cleanup(
  p_storage_path text,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage product image cleanup';
  end if;

  if p_storage_path is null
     or btrim(p_storage_path) = ''
     or p_storage_path ~* '^https?://'
     or p_storage_path like '%..%' then
    raise exception 'Invalid product image storage path';
  end if;

  insert into public.product_image_cleanup_queue(storage_path, last_error)
  values (p_storage_path, left(coalesce(p_error_message, 'Storage deletion failed'), 1000))
  on conflict (storage_path) do update
    set next_attempt_at = least(public.product_image_cleanup_queue.next_attempt_at, now()),
        last_error = excluded.last_error,
        updated_at = now();
end;
$function$;

revoke all on function public.enqueue_product_image_cleanup(text, text) from public, anon;
grant execute on function public.enqueue_product_image_cleanup(text, text) to authenticated;

create or replace function public.list_product_image_cleanup_queue(p_limit integer default 100)
returns table(storage_path text)
language sql
security definer
set search_path = ''
as $function$
  select q.storage_path
  from public.product_image_cleanup_queue q
  where q.next_attempt_at <= now()
  order by q.next_attempt_at asc, q.created_at asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;
revoke all on function public.list_product_image_cleanup_queue(integer) from public, anon, authenticated;
grant execute on function public.list_product_image_cleanup_queue(integer) to service_role;

create or replace function public.complete_product_image_cleanup(p_storage_path text)
returns void
language sql
security definer
set search_path = ''
as $function$
  delete from public.product_image_cleanup_queue
  where storage_path = p_storage_path;
$function$;
revoke all on function public.complete_product_image_cleanup(text) from public, anon, authenticated;
grant execute on function public.complete_product_image_cleanup(text) to service_role;

create or replace function public.fail_product_image_cleanup(p_storage_path text, p_error_message text)
returns void
language sql
security definer
set search_path = ''
as $function$
  update public.product_image_cleanup_queue
  set attempts = attempts + 1,
      last_error = left(coalesce(p_error_message, 'Storage deletion failed'), 1000),
      next_attempt_at = now() + (interval '1 minute' * least(1440, power(2, least(attempts, 10))::integer)),
      updated_at = now()
  where storage_path = p_storage_path;
$function$;
revoke all on function public.fail_product_image_cleanup(text, text) from public, anon, authenticated;
grant execute on function public.fail_product_image_cleanup(text, text) to service_role;
