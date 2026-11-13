-- Verify the cleanup migration upgrades the legacy Production table shape.
\set ON_ERROR_STOP on

create schema if not exists auth;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$$;
create or replace function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
create or replace function auth.jwt() returns json language sql stable as $$ select '{"role":"service_role"}'::json $$;
create or replace function public.can_manage_catalog() returns boolean language sql stable as $$ select true $$;

create type public.image_kind as enum ('main', 'gallery');
create table public.products (id uuid primary key);
create table public.product_images (
  id uuid primary key,
  product_id uuid not null references public.products(id),
  storage_path text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  image_type public.image_kind not null default 'gallery'
);

create table public.product_image_cleanup_queue (
  storage_path text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_image_cleanup_queue enable row level security;
insert into public.product_image_cleanup_queue(storage_path) values ('legacy/product-image.jpg');

\ir ../supabase/migrations/202611120001_product_image_cleanup_queue.sql
\ir ../supabase/migrations/20261112070000_queue_failed_replacement_image_cleanup.sql

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.product_image_cleanup_queue
   where storage_path='legacy/product-image.jpg';
  if v_id is null then raise exception 'Legacy queue row was not preserved or backfilled'; end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='product_image_cleanup_queue' and column_name='locked_at'
  ) then raise exception 'Worker lease column was not added'; end if;
  if not (select relrowsecurity from pg_class where oid='public.product_image_cleanup_queue'::regclass) then
    raise exception 'Cleanup queue RLS is not enabled';
  end if;
  if has_table_privilege('anon','public.product_image_cleanup_queue','SELECT')
     or has_table_privilege('authenticated','public.product_image_cleanup_queue','SELECT') then
    raise exception 'Client roles can read cleanup queue';
  end if;
  if not has_function_privilege('service_role','public.claim_product_image_cleanup(integer)','EXECUTE')
     or has_function_privilege('anon','public.claim_product_image_cleanup(integer)','EXECUTE') then
    raise exception 'Cleanup RPC grants are incorrect';
  end if;
end
$$;



-- The replacement cleanup migration must queue only detached paths and prevent
-- image rows from being attached to paths already scheduled for deletion.
do $$
declare
  v_product uuid := '00000000-0000-0000-0000-000000000101';
  v_image uuid := '00000000-0000-0000-0000-000000000102';
begin
  insert into public.products(id) values (v_product);

  perform public.admin_enqueue_product_image_cleanup('unreferenced/new-upload.jpg');
  if not exists (
    select 1 from public.product_image_cleanup_queue
    where storage_path = 'unreferenced/new-upload.jpg'
  ) then
    raise exception 'Unreferenced upload was not queued';
  end if;

  begin
    insert into public.product_images(id, product_id, storage_path)
    values (v_image, v_product, 'unreferenced/new-upload.jpg');
    raise exception 'Expected pending cleanup path insert to be rejected';
  exception when raise_exception then
    if sqlerrm = 'Expected pending cleanup path insert to be rejected' then raise; end if;
  end;

  insert into public.product_images(id, product_id, storage_path)
  values ('00000000-0000-0000-0000-000000000103', v_product, 'detached/old-image.jpg');

  perform public.admin_delete_product_image(
    v_product,
    '00000000-0000-0000-0000-000000000103'
  );

  if exists (
    select 1 from public.product_images
    where id = '00000000-0000-0000-0000-000000000103'
  ) then
    raise exception 'Image row was not deleted';
  end if;
  if not exists (
    select 1 from public.product_image_cleanup_queue
    where storage_path = 'detached/old-image.jpg'
  ) then
    raise exception 'Deleted image was not queued for cleanup';
  end if;

  insert into public.product_images(id, product_id, storage_path)
  values ('00000000-0000-0000-0000-000000000104', v_product, 'shared/used-image.jpg');

  begin
    perform public.admin_enqueue_product_image_cleanup('shared/used-image.jpg');
    raise exception 'Expected referenced path enqueue to be rejected';
  exception when raise_exception then
    if sqlerrm = 'Expected referenced path enqueue to be rejected' then raise; end if;
  end;
end
$$;

select 'product image cleanup migration and safety tests passed' as result;


-- Image replacement and cleanup enqueue must commit or roll back together.
\\ir ../supabase/migrations/20261113125359_admin_replace_product_image_atomic_cleanup.sql
\\ir ../supabase/migrations/20261113125417_tighten_atomic_image_replacement_path_validation.sql

create or replace function public.reject_cleanup_queue_insert()
returns trigger language plpgsql as $$
begin
  if new.storage_path = 'old/force-queue-failure.jpg' then
    raise exception 'simulated cleanup queue failure';
  end if;
  return new;
end
$$;

do $$
declare
  v_product uuid := '00000000-0000-0000-0000-000000000201';
  v_image uuid := '00000000-0000-0000-0000-000000000202';
  v_path text;
begin
  insert into public.products(id) values (v_product);
  insert into public.product_images(id, product_id, storage_path)
  values (v_image, v_product, 'old/previous-image.jpg');

  perform public.admin_replace_product_image(
    v_product, v_image, 'r2://' || v_product::text || '/replacement.webp'
  );

  select storage_path into v_path from public.product_images where id = v_image;
  if v_path <> 'r2://' || v_product::text || '/replacement.webp' then
    raise exception 'Image replacement did not persist';
  end if;
  if not exists (
    select 1 from public.product_image_cleanup_queue
    where storage_path = 'old/previous-image.jpg'
  ) then
    raise exception 'Previous image was not queued in the replacement transaction';
  end if;

  update public.product_images
  set storage_path = 'old/force-queue-failure.jpg'
  where id = v_image;
  create trigger reject_cleanup_queue_insert
    before insert on public.product_image_cleanup_queue
    for each row execute function public.reject_cleanup_queue_insert();

  begin
    perform public.admin_replace_product_image(
      v_product, v_image, 'r2://' || v_product::text || '/replacement-2.webp'
    );
    raise exception 'Expected cleanup queue failure to abort image replacement';
  exception when raise_exception then
    if sqlerrm = 'Expected cleanup queue failure to abort image replacement' then raise; end if;
  end;

  select storage_path into v_path from public.product_images where id = v_image;
  if v_path <> 'old/force-queue-failure.jpg' then
    raise exception 'Image row changed even though cleanup enqueue failed';
  end if;

  drop trigger reject_cleanup_queue_insert on public.product_image_cleanup_queue;

  begin
    perform public.admin_replace_product_image(
      v_product, v_image, 'r2://another-product/not-owned.webp'
    );
    raise exception 'Expected cross-product storage path to be rejected';
  exception when raise_exception then
    if sqlerrm = 'Expected cross-product storage path to be rejected' then raise; end if;
  end;
end
$$;

drop function public.reject_cleanup_queue_insert();
select 'atomic product image replacement tests passed' as result;
